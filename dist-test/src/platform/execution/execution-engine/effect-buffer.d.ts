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
 * @see Architecture: docs_zh/architecture/00-platform-architecture.md
 * @see Runtime Execution Contract: docs_zh/contracts/runtime_execution_contract.md
 */
/**
 * Types of side effects that can be buffered.
 */
export type EffectType = "event_publish" | "stream_emit" | "callback_invoke" | "ui_update" | "external_notification" | "artifact_flush" | "metric_record";
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
export declare class EffectBuilder {
    private effect;
    private constructor();
    static create(type: EffectType, description: string): EffectBuilder;
    withId(id: string): EffectBuilder;
    withPriority(priority: EffectPriority): EffectBuilder;
    withExecute(fn: () => Promise<void>): EffectBuilder;
    withCompensate(fn: () => Promise<void>): EffectBuilder;
    withTimeout(timeoutMs: number): EffectBuilder;
    continueOnFailure(): EffectBuilder;
    build(): Effect;
}
/**
 * EffectScope manages a collection of effects that should be executed together
 * after a transaction successfully commits.
 */
export declare class EffectScope {
    private readonly scopeId;
    private readonly effects;
    private readonly defaultTimeoutMs;
    private readonly stopOnFailure;
    private readonly log;
    private committed;
    private rolledBack;
    private readonly createdAt;
    constructor(options: EffectScopeOptions);
    /**
     * C-10: Returns the scope creation timestamp for TTL tracking.
     */
    getCreatedAt(): number;
    /**
     * Adds an effect to this scope.
     * Effects are executed in priority order after commit.
     */
    addEffect(effect: Effect): void;
    /**
     * Adds an effect using a fluent builder pattern.
     */
    add(type: EffectType, description: string, execute: () => Promise<void>): EffectScope;
    /**
     * Marks this scope as successfully committed.
     * After calling this, effects will be executed.
     */
    commit(): void;
    /**
     * Marks this scope as rolled back.
     * Effects will not be executed.
     */
    rollback(): void;
    /**
     * Returns true if this scope has been committed.
     */
    isCommitted(): boolean;
    /**
     * Returns true if this scope has been rolled back.
     */
    isRolledBack(): boolean;
    /**
     * Returns the number of effects in this scope.
     */
    getEffectCount(): number;
    /**
     * Executes all effects in this scope.
     * Effects are sorted by priority before execution.
     */
    executeEffects(): Promise<EffectScopeResult>;
    /**
     * Executes compensation functions for all effects that were executed.
     * Called when a later effect fails and we need to undo previous effects.
     */
    compensateEffects(results: readonly EffectResult[]): Promise<void>;
}
/**
 * EffectBuffer manages multiple effect scopes and coordinates their execution.
 */
export declare class EffectBuffer {
    private readonly scopes;
    private readonly log;
    private readonly MAX_SCOPES;
    private readonly SCOPE_TTL_MS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    constructor(logger?: (message: string, context?: Record<string, unknown>) => void);
    /**
     * C-10: Evict expired and excess scopes to prevent memory leaks.
     */
    private evictExpiredScopes;
    /**
     * Creates a new effect scope.
     */
    createScope(options: EffectScopeOptions): EffectScope;
    /**
     * Gets an existing scope by ID.
     */
    getScope(scopeId: string): EffectScope | undefined;
    /**
     * Removes a scope from the buffer.
     */
    removeScope(scopeId: string): void;
    /**
     * Executes all committed scopes in order.
     */
    flush(): Promise<readonly EffectScopeResult[]>;
    /**
     * Returns the number of scopes in this buffer.
     */
    getScopeCount(): number;
    /**
     * Clears all scopes from the buffer.
     */
    clear(): void;
}
/**
 * Global effect buffer instance for application-wide side effect management.
 */
export declare const globalEffectBuffer: EffectBuffer;
