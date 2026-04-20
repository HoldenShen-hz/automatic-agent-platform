/**
 * @fileoverview Effect Buffer - Post-transaction side effect execution.
 *
 * Provides guaranteed side effect execution after successful transaction commits.
 * Effects are buffered during transaction execution and only executed after
 * the transaction succeeds, ensuring atomicity between state changes and side effects.
 *
 * Key concepts:
 * - Effect: A side effect action (event emission, UI update, external callback)
 * - Effect Buffer: Collects effects during transaction, executes after commit
 * - Effect Scope: Groups related effects for coordinated execution
 *
 * @see Architecture: docs_zh/automatic_agent_patform_arthitecture_design.md
 * @see Runtime Execution Contract: docs_zh/contracts/runtime_execution_contract.md
 */

import { randomUUID } from "node:crypto";
import { BoundedCache } from "../../shared/utils/bounded-cache.js";
import { RuntimeError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Types of side effects that can be buffered.
 */
export type EffectType =
  | "event_publish"
  | "stream_emit"
  | "callback_invoke"
  | "ui_update"
  | "external_notification"
  | "artifact_flush"
  | "metric_record";

/**
 * Priority of effect execution within the same scope.
 * Higher priority effects execute first.
 */
export type EffectPriority = "critical" | "high" | "normal" | "low";

/**
 * A single side effect to be executed after transaction commit.
 */
export interface Effect {
  /** Unique identifier for this effect */
  id: string;
  /** Type of effect to execute */
  type: EffectType;
  /** Human-readable description for debugging */
  description: string;
  /** Execution priority within the effect scope */
  priority: EffectPriority;
  /** The actual effect function to execute */
  execute: () => Promise<void>;
  /** Compensation function to undo the effect if needed */
  compensate?: () => Promise<void>;
  /** Maximum time to wait for effect execution (ms) */
  timeoutMs?: number;
  /** Whether to continue if this effect fails */
  continueOnFailure: boolean;
}

/**
 * Result of executing a single effect.
 */
export interface EffectResult {
  effectId: string;
  type: EffectType;
  success: boolean;
  durationMs: number;
  error?: Error;
}

/**
 * Result of executing all effects in a scope.
 */
export interface EffectScopeResult {
  scopeId: string;
  totalEffects: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: readonly EffectResult[];
  totalDurationMs: number;
  allSucceeded: boolean;
}

/**
 * Options for creating an effect scope.
 */
export interface EffectScopeOptions {
  /** Unique identifier for this effect scope */
  scopeId: string;
  /** Default timeout for effects in this scope */
  defaultTimeoutMs?: number;
  /** Whether to stop executing effects if one fails */
  stopOnFailure?: boolean;
  /** Logger for debugging */
  logger?: (message: string, context?: Record<string, unknown>) => void;
}

/**
 * Builder for creating effects with fluent API.
 */
export class EffectBuilder {
  private effect: Partial<Effect>;

  private constructor(type: EffectType, description: string) {
    this.effect = {
      id: `effect_${Date.now()}_${randomUUID()}`,
      type,
      description,
      priority: "normal",
      continueOnFailure: false,
    };
  }

  static create(type: EffectType, description: string): EffectBuilder {
    return new EffectBuilder(type, description);
  }

  withId(id: string): EffectBuilder {
    this.effect.id = id;
    return this;
  }

  withPriority(priority: EffectPriority): EffectBuilder {
    this.effect.priority = priority;
    return this;
  }

  withExecute(fn: () => Promise<void>): EffectBuilder {
    this.effect.execute = fn;
    return this;
  }

  withCompensate(fn: () => Promise<void>): EffectBuilder {
    this.effect.compensate = fn;
    return this;
  }

  withTimeout(timeoutMs: number): EffectBuilder {
    this.effect.timeoutMs = timeoutMs;
    return this;
  }

  continueOnFailure(): EffectBuilder {
    this.effect.continueOnFailure = true;
    return this;
  }

  build(): Effect {
    if (!this.effect.execute) {
      throw new RuntimeError("effect_builder.missing_execute", "effect_builder.missing_execute: Effect must have an execute function", {
        details: { effectId: this.effect.id },
      });
    }
    return this.effect as Effect;
  }
}

/**
 * EffectScope manages a collection of effects that should be executed together
 * after a transaction successfully commits.
 */
export class EffectScope {
  private readonly scopeId: string;
  private readonly effects: Effect[] = [];
  private readonly defaultTimeoutMs: number;
  private readonly stopOnFailure: boolean;
  private readonly log: (message: string, context?: Record<string, unknown>) => void;
  private committed = false;
  private rolledBack = false;
  // C-10: Track creation time for TTL-based eviction
  private readonly createdAt: number;

  constructor(options: EffectScopeOptions) {
    this.scopeId = options.scopeId;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;
    this.stopOnFailure = options.stopOnFailure ?? false;
    this.log = options.logger ?? (() => {});
    this.createdAt = Date.now();
  }

  /**
   * C-10: Returns the scope creation timestamp for TTL tracking.
   */
  getCreatedAt(): number {
    return this.createdAt;
  }

  /**
   * Adds an effect to this scope.
   * Effects are executed in priority order after commit.
   */
  addEffect(effect: Effect): void {
    if (this.committed) {
      throw new RuntimeError("effect_scope.already_committed", `effect_scope.already_committed: Effect scope already committed: ${this.scopeId}`, {
        details: { scopeId: this.scopeId },
      });
    }
    if (this.rolledBack) {
      throw new RuntimeError("effect_scope.already_rolled_back", `effect_scope.already_rolled_back: Effect scope already rolled back: ${this.scopeId}`, {
        details: { scopeId: this.scopeId },
      });
    }
    this.effects.push(effect);
    this.log("effect_added", {
      scopeId: this.scopeId,
      effectId: effect.id,
      type: effect.type,
      priority: effect.priority,
    });
  }

  /**
   * Adds an effect using a fluent builder pattern.
   */
  add(type: EffectType, description: string, execute: () => Promise<void>): EffectScope {
    const effect = EffectBuilder.create(type, description)
      .withExecute(execute)
      .build();
    this.addEffect(effect);
    return this;
  }

  /**
   * Marks this scope as successfully committed.
   * After calling this, effects will be executed.
   */
  commit(): void {
    if (this.rolledBack) {
      throw new RuntimeError("effect_scope.already_rolled_back", `effect_scope.already_rolled_back: Effect scope already rolled back: ${this.scopeId}`, {
        details: { scopeId: this.scopeId },
      });
    }
    this.committed = true;
    this.log("effect_scope_committed", {
      scopeId: this.scopeId,
      effectCount: this.effects.length,
    });
  }

  /**
   * Marks this scope as rolled back.
   * Effects will not be executed.
   */
  rollback(): void {
    this.rolledBack = true;
    this.log("effect_scope_rolled_back", {
      scopeId: this.scopeId,
      effectCount: this.effects.length,
    });
  }

  /**
   * Returns true if this scope has been committed.
   */
  isCommitted(): boolean {
    return this.committed;
  }

  /**
   * Returns true if this scope has been rolled back.
   */
  isRolledBack(): boolean {
    return this.rolledBack;
  }

  /**
   * Returns the number of effects in this scope.
   */
  getEffectCount(): number {
    return this.effects.length;
  }

  /**
   * Executes all effects in this scope.
   * Effects are sorted by priority before execution.
   */
  async executeEffects(): Promise<EffectScopeResult> {
    const startTime = Date.now();

    if (!this.committed) {
      throw new RuntimeError("effect_scope.not_committed", `effect_scope.not_committed: Effect scope not committed: ${this.scopeId}`, {
        details: { scopeId: this.scopeId },
      });
    }

    if (this.rolledBack) {
      return {
        scopeId: this.scopeId,
        totalEffects: this.effects.length,
        succeeded: 0,
        failed: 0,
        skipped: this.effects.length,
        results: [],
        totalDurationMs: 0,
        allSucceeded: true,
      };
    }

    this.log("executing_effects", {
      scopeId: this.scopeId,
      effectCount: this.effects.length,
    });

    const sortedEffects = [...this.effects].sort((a, b) => {
      const priorityOrder: Record<EffectPriority, number> = {
        critical: 0,
        high: 1,
        normal: 2,
        low: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const results: EffectResult[] = [];
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (const effect of sortedEffects) {
      const effectStart = Date.now();

      try {
        const timeout = effect.timeoutMs ?? this.defaultTimeoutMs;
        await Promise.race([
          effect.execute(),
          new Promise<void>((_, reject) => {
            const timer = setTimeout(() => reject(new Error(`effect.timeout:${effect.id}`)), timeout);
            timer.unref(); // R-01: Prevent timer from keeping event loop alive
          }),
        ]);

        results.push({
          effectId: effect.id,
          type: effect.type,
          success: true,
          durationMs: Date.now() - effectStart,
        });
        succeeded++;
        this.log("effect_succeeded", {
          scopeId: this.scopeId,
          effectId: effect.id,
          type: effect.type,
          durationMs: Date.now() - effectStart,
        });
      } catch (error) {
        const errorResult: EffectResult = {
          effectId: effect.id,
          type: effect.type,
          success: false,
          durationMs: Date.now() - effectStart,
          error: error instanceof Error ? error : new Error(String(error)),
        };
        results.push(errorResult);
        failed++;
        this.log("effect_failed", {
          scopeId: this.scopeId,
          effectId: effect.id,
          type: effect.type,
          error: error instanceof Error ? error.message : String(error),
          continueOnFailure: effect.continueOnFailure,
        });

        if (!effect.continueOnFailure && this.stopOnFailure) {
          skipped = sortedEffects.indexOf(effect) + 1;
          break;
        }
      }
    }

    return {
      scopeId: this.scopeId,
      totalEffects: this.effects.length,
      succeeded,
      failed,
      skipped: this.effects.length - succeeded - failed,
      results,
      totalDurationMs: Date.now() - startTime,
      allSucceeded: failed === 0,
    };
  }

  /**
   * Executes compensation functions for all effects that were executed.
   * Called when a later effect fails and we need to undo previous effects.
   */
  async compensateEffects(results: readonly EffectResult[]): Promise<void> {
    const executedEffects = results
      .filter((r) => r.success)
      .map((r) => this.effects.find((e) => e.id === r.effectId))
      .filter((e): e is Effect => e != null && e.compensate != null);

    for (const effect of executedEffects.reverse()) {
      try {
        await effect.compensate!();
        this.log("effect_compensated", {
          scopeId: this.scopeId,
          effectId: effect.id,
        });
      } catch (error) {
        this.log("effect_compensation_failed", {
          scopeId: this.scopeId,
          effectId: effect.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

/**
 * EffectBuffer manages multiple effect scopes and coordinates their execution.
 */
export class EffectBuffer {
  private readonly scopes: BoundedCache<string, EffectScope> = new BoundedCache(50);
  private readonly log: (message: string, context?: Record<string, unknown>) => void;
  // C-10: TTL-based eviction to prevent memory leaks
  private readonly MAX_SCOPES = 100;
  private readonly SCOPE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 5 * 60 * 1000; // Once per 5 minutes

  constructor(logger?: (message: string, context?: Record<string, unknown>) => void) {
    this.log = logger ?? (() => {});
  }

  /**
   * C-10: Evict expired and excess scopes to prevent memory leaks.
   */
  private evictExpiredScopes(): void {
    const now = Date.now();
    if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
      return;
    }
    this.lastEvictionTime = now;

    const expiryThreshold = now - this.SCOPE_TTL_MS;

    for (const [scopeId, scope] of this.scopes) {
      const createdAt = scope.getCreatedAt();
      if (createdAt < expiryThreshold) {
        this.scopes.delete(scopeId);
        this.log("scope_evicted_expired", { scopeId });
      }
    }

    // If still over capacity, remove oldest scopes
    if (this.scopes.size > this.MAX_SCOPES) {
      const sortedEntries = [...this.scopes.entries()].sort((a, b) => {
        return a[1].getCreatedAt() - b[1].getCreatedAt();
      });

      const toRemove = this.scopes.size - this.MAX_SCOPES;
      for (let i = 0; i < toRemove; i++) {
        this.scopes.delete(sortedEntries[i]![0]);
        this.log("scope_evicted_capacity", { scopeId: sortedEntries[i]![0] });
      }
    }
  }

  /**
   * Creates a new effect scope.
   */
  createScope(options: EffectScopeOptions): EffectScope {
    // C-10: Evict expired scopes before creating new one
    this.evictExpiredScopes();

    const scope = new EffectScope({
      ...options,
      logger: this.log,
    });
    this.scopes.set(options.scopeId, scope);
    this.log("scope_created", { scopeId: options.scopeId });
    return scope;
  }

  /**
   * Gets an existing scope by ID.
   */
  getScope(scopeId: string): EffectScope | undefined {
    return this.scopes.get(scopeId);
  }

  /**
   * Removes a scope from the buffer.
   */
  removeScope(scopeId: string): void {
    this.scopes.delete(scopeId);
    this.log("scope_removed", { scopeId });
  }

  /**
   * Executes all committed scopes in order.
   */
  async flush(): Promise<readonly EffectScopeResult[]> {
    const results: EffectScopeResult[] = [];

    for (const [scopeId, scope] of this.scopes) {
      if (scope.isRolledBack()) {
        this.log("scope_skipped_rolled_back", { scopeId });
        continue;
      }

      if (!scope.isCommitted()) {
        this.log("scope_skipped_not_committed", { scopeId });
        continue;
      }

      const result = await scope.executeEffects();
      results.push(result);

      if (!result.allSucceeded) {
        this.log("scope_had_failures", {
          scopeId,
          succeeded: result.succeeded,
          failed: result.failed,
        });
      }
    }

    return results;
  }

  /**
   * Returns the number of scopes in this buffer.
   */
  getScopeCount(): number {
    return this.scopes.size;
  }

  /**
   * Clears all scopes from the buffer.
   */
  clear(): void {
    this.scopes.clear();
    this.log("buffer_cleared");
  }
}

/**
 * Global effect buffer instance for application-wide side effect management.
 */
export const globalEffectBuffer = new EffectBuffer((message, context) => {
  logger.log({ level: "debug", message: `[effect_buffer:${message}]`, data: context ?? {} });
});
