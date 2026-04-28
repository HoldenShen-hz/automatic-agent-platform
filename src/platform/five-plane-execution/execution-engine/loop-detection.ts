/**
 * @fileoverview Doom Loop Detection - Prevents infinite repetition loops.
 *
 * Detects repeated tool calls with same normalized input using hash.
 * - 3 occurrences: warn/ask
 * - 5 occurrences: escalate/terminate
 */

import { createHash } from "node:crypto";
import { nowIso } from "../../contracts/types/ids.js";
import type { MiddlewareContext, MiddlewareResult, BeforeAgentHook, WrapToolCallHook } from "./agent-middleware-chain.js";
import { RuntimeError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Represents a detected loop pattern.
 */
export interface LoopPattern {
  /** Tool name that triggered the loop */
  toolName: string;
  /** Normalized input hash */
  inputHash: string;
  /** Human-readable input summary */
  inputSummary: string;
  /** Number of times this pattern was detected */
  count: number;
  /** First occurrence timestamp */
  firstSeen: string;
  /** Last occurrence timestamp */
  lastSeen: string;
  /** Whether escalation has been triggered */
  escalated: boolean;
}

/**
 * Loop detection configuration.
 */
export interface LoopDetectionConfig {
  /** Maximum number of repeats before warning (default: 3) */
  warnThreshold?: number;
  /** Maximum number of repeats before escalation (default: 5) */
  escalateThreshold?: number;
  /** Whether to ask user at warn threshold (default: true) */
  askAtWarn?: boolean;
  /** Whether to terminate at escalate threshold (default: true) */
  terminateAtEscalate?: boolean;
  /** Custom hash function for tool + input (default: built-in) */
  hashFn?: (toolName: string, input: unknown) => string;
}

/**
 * Normalizes tool input to a hash for comparison.
 */
export function normalizeToolInputForHash(input: unknown): string {
  if (input === null || input === undefined) {
    return "null";
  }
  if (typeof input === "string") {
    return input.trim().toLowerCase();
  }
  if (typeof input === "object") {
    const sorted = JSON.stringify(input, Object.keys(input).sort());
    return sorted.toLowerCase().trim();
  }
  return String(input);
}

/**
 * Creates a hash of the tool call for loop detection.
 */
export function hashToolCall(toolName: string, input: unknown): string {
  const normalized = normalizeToolInputForHash(input);
  return createHash("sha256").update(`${toolName}:${normalized}`).digest("hex").slice(0, 16);
}

/**
 * Loop detection state manager.
 */
export class LoopDetectionState {
  private patterns: Map<string, LoopPattern> = new Map();
  private config: Required<LoopDetectionConfig>;
  // C-11: TTL-based eviction to prevent memory leaks
  private readonly PATTERN_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_PATTERNS = 1000;
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute

  constructor(config: LoopDetectionConfig = {}) {
    this.config = {
      warnThreshold: config.warnThreshold ?? 3,
      escalateThreshold: config.escalateThreshold ?? 5,
      askAtWarn: config.askAtWarn ?? true,
      terminateAtEscalate: config.terminateAtEscalate ?? true,
      hashFn: config.hashFn ?? hashToolCall,
    };
  }

  /**
   * C-11: Evict expired loop patterns to prevent memory leaks.
   */
  private evictExpiredPatterns(): void {
    const now = Date.now();
    if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
      return;
    }
    this.lastEvictionTime = now;

    const expiryThreshold = now - this.PATTERN_TTL_MS;

    for (const [key, pattern] of this.patterns) {
      const firstSeen = new Date(pattern.firstSeen).getTime();
      if (firstSeen < expiryThreshold) {
        this.patterns.delete(key);
      }
    }

    // If still over capacity, remove oldest patterns
    if (this.patterns.size > this.MAX_PATTERNS) {
      const sortedEntries = [...this.patterns.entries()].sort((a, b) => {
        const aTime = new Date(a[1].firstSeen).getTime();
        const bTime = new Date(b[1].firstSeen).getTime();
        return aTime - bTime;
      });

      const toRemove = this.patterns.size - this.MAX_PATTERNS;
      for (let i = 0; i < toRemove; i++) {
        this.patterns.delete(sortedEntries[i]![0]);
      }
    }
  }

  /**
   * Record a tool call and check for loops.
   */
  recordToolCall(
    toolName: string,
    input: unknown,
  ): { pattern: LoopPattern; action: "continue" | "warn" | "escalate" } {
    // C-11: Evict expired patterns before recording new one
    this.evictExpiredPatterns();

    const inputHash = this.config.hashFn(toolName, input);
    const key = `${toolName}:${inputHash}`;
    const now = nowIso();

    const inputSummary = normalizeToolInputForHash(input).slice(0, 100);

    let pattern = this.patterns.get(key);
    if (!pattern) {
      pattern = {
        toolName,
        inputHash,
        inputSummary,
        count: 0,
        firstSeen: now,
        lastSeen: now,
        escalated: false,
      };
      this.patterns.set(key, pattern);
    }

    pattern.count++;
    pattern.lastSeen = now;

    let action: "continue" | "warn" | "escalate" = "continue";
    if (pattern.count >= this.config.escalateThreshold) {
      action = "escalate";
      pattern.escalated = true;
    } else if (pattern.count >= this.config.warnThreshold) {
      action = "warn";
    }

    return { pattern, action };
  }

  /**
   * Get all current loop patterns.
   */
  getPatterns(): LoopPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get patterns that have escalated.
   */
  getEscalatedPatterns(): LoopPattern[] {
    const patterns: LoopPattern[] = [];
    for (const p of this.patterns.values()) {
      if (p.escalated) {
        patterns.push(p);
      }
    }
    return patterns;
  }

  /**
   * Get current repeat count for a tool call.
   */
  getRepeatCount(toolName: string, input: unknown): number {
    const inputHash = this.config.hashFn(toolName, input);
    const key = `${toolName}:${inputHash}`;
    return this.patterns.get(key)?.count ?? 0;
  }

  /**
   * Check if a tool call would trigger escalation.
   */
  wouldEscalate(toolName: string, input: unknown): boolean {
    return this.getRepeatCount(toolName, input) >= this.config.escalateThreshold;
  }

  /**
   * Clear all patterns.
   */
  reset(): void {
    this.patterns.clear();
  }

  /**
   * Remove a specific pattern.
   */
  removePattern(toolName: string, input: unknown): void {
    const inputHash = this.config.hashFn(toolName, input);
    const key = `${toolName}:${inputHash}`;
    this.patterns.delete(key);
  }

  /**
   * Get configuration.
   */
  getConfig(): Readonly<Required<LoopDetectionConfig>> {
    return { ...this.config };
  }
}

/**
 * Creates a before_agent middleware hook for loop detection.
 */
export function createLoopDetectionMiddleware(
  config: LoopDetectionConfig = {},
): {
  middleware: BeforeAgentHook;
  state: LoopDetectionState;
} {
  const state = new LoopDetectionState(config);

  const middleware: BeforeAgentHook = {
    name: "loop_detection",
    priority: 10,
    run: async (ctx: MiddlewareContext, input: { request: string; history: unknown[] }): Promise<MiddlewareResult> => {
      const patterns = state.getPatterns();
      const escalatedPatterns = patterns.filter((p) => p.escalated);

      if (escalatedPatterns.length > 0) {
        return {
          success: false,
          error: {
            code: "loop_detection.escalated",
            message: `Detected ${escalatedPatterns.length} escalated loop pattern(s). Task terminated.`,
            warning: false,
          },
        };
      }

      const warningPatterns = patterns.filter((p) => p.count >= state.getConfig().warnThreshold && !p.escalated);
      if (warningPatterns.length > 0) {
        return {
          success: true,
          input,
          error: {
            code: "loop_detection.warning",
            message: `Detected ${warningPatterns.length} potential loop pattern(s): ${warningPatterns.map((p) => `${p.toolName}(${p.count})`).join(", ")}`,
            warning: true,
          },
        };
      }

      return { success: true };
    },
  };

  return { middleware, state };
}

export interface LoopDetectionMiddlewareSet {
  beforeAgent: BeforeAgentHook;
  wrapToolCall: WrapToolCallHook;
  state: LoopDetectionState;
}

export function createLoopDetectionMiddlewareFull(
  config: LoopDetectionConfig = {},
): LoopDetectionMiddlewareSet {
  const state = new LoopDetectionState(config);

  const beforeAgent: BeforeAgentHook = {
    name: "loop_detection_before_agent",
    priority: 10,
    run: async (ctx: MiddlewareContext, input: { request: string; history: unknown[] }): Promise<MiddlewareResult> => {
      const patterns = state.getPatterns();
      const escalatedPatterns = patterns.filter((p) => p.escalated);

      if (escalatedPatterns.length > 0) {
        return {
          success: false,
          error: {
            code: "loop_detection.escalated",
            message: `Detected ${escalatedPatterns.length} escalated loop pattern(s). Task terminated.`,
            warning: false,
          },
        };
      }

      const warningPatterns = patterns.filter((p) => p.count >= state.getConfig().warnThreshold && !p.escalated);
      if (warningPatterns.length > 0) {
        return {
          success: true,
          input,
          error: {
            code: "loop_detection.warning",
            message: `Detected ${warningPatterns.length} potential loop pattern(s): ${warningPatterns.map((p) => `${p.toolName}(${p.count})`).join(", ")}`,
            warning: true,
          },
        };
      }

      return { success: true };
    },
  };

  const wrapToolCall: WrapToolCallHook = {
    name: "loop_detection_wrap_tool_call",
    priority: 10,
    run: async <T>(
      ctx: MiddlewareContext,
      input: { toolName: string; args: Record<string, unknown> },
      next: () => Promise<T>,
    ): Promise<T> => {
      const { pattern, action } = state.recordToolCall(input.toolName, input.args);

      if (action === "escalate") {
        throw new RuntimeError("loop_detection.escalated", `Tool ${input.toolName} repeated ${pattern.count} times`, {
          details: { toolName: input.toolName, count: pattern.count, inputSummary: pattern.inputSummary },
        });
      }

      if (action === "warn") {
        logger.log({ level: "warn", message: `Tool ${input.toolName} repeated ${pattern.count} times`, data: { toolName: input.toolName, count: pattern.count, inputSummary: pattern.inputSummary } });
      }

      return next();
    },
  };

  return { beforeAgent, wrapToolCall, state };
}

/**
 * Doom loop detection for repeated same-action sequences.
 */
export interface SequenceLoopDetectionConfig {
  /** Window size for sequence analysis (default: 5) */
  windowSize?: number;
  /** Threshold for same-sequence repeats (default: 3) */
  repeatThreshold?: number;
}

interface ActionSequence {
  sequence: string[];
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export class SequenceLoopDetector {
  private sequences: Map<string, ActionSequence> = new Map();
  private actionHistory: string[] = [];
  private config: Required<SequenceLoopDetectionConfig>;
  // C-11: TTL-based eviction to prevent memory leaks
  private readonly MAX_SEQUENCES = 500;
  private readonly SEQUENCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute

  constructor(config: SequenceLoopDetectionConfig = {}) {
    this.config = {
      windowSize: config.windowSize ?? 5,
      repeatThreshold: config.repeatThreshold ?? 3,
    };
  }

  /**
   * C-11: Evict expired sequence entries to prevent memory leaks.
   */
  private evictExpired(): void {
    const now = Date.now();
    if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
      return;
    }
    this.lastEvictionTime = now;

    const expiryThreshold = now - this.SEQUENCE_TTL_MS;

    // Evict expired sequences
    for (const [key, seq] of this.sequences) {
      const firstSeen = new Date(seq.firstSeen).getTime();
      if (firstSeen < expiryThreshold) {
        this.sequences.delete(key);
      }
    }

    // If still over capacity, remove oldest sequences
    if (this.sequences.size > this.MAX_SEQUENCES) {
      const sortedEntries = [...this.sequences.entries()].sort((a, b) => {
        const aTime = new Date(a[1].firstSeen).getTime();
        const bTime = new Date(b[1].firstSeen).getTime();
        return aTime - bTime;
      });

      const toRemove = this.sequences.size - this.MAX_SEQUENCES;
      for (let i = 0; i < toRemove; i++) {
        this.sequences.delete(sortedEntries[i]![0]);
      }
    }
  }

  /**
   * Record an action and check for sequence loops.
   */
  recordAction(action: string): { isLoop: boolean; sequence: string[]; count: number } {
    // C-11: Evict expired entries before recording new action
    this.evictExpired();

    this.actionHistory.push(action);
    if (this.actionHistory.length > this.config.windowSize * 2) {
      this.actionHistory = this.actionHistory.slice(-this.config.windowSize);
    }

    const now = nowIso();
    let isLoop = false;
    let detectedSequence: string[] = [];
    let detectedCount = 0;

    if (this.actionHistory.length >= this.config.windowSize) {
      const windowStart = this.actionHistory.length - this.config.windowSize;
      const currentWindow = this.actionHistory.slice(windowStart);
      const sequenceKey = currentWindow.join("|");

      let seq = this.sequences.get(sequenceKey);
      if (!seq) {
        seq = {
          sequence: [...currentWindow],
          count: 0,
          firstSeen: now,
          lastSeen: now,
        };
        this.sequences.set(sequenceKey, seq);
      }

      seq.count++;
      seq.lastSeen = now;
      isLoop = seq.count >= this.config.repeatThreshold;
      detectedSequence = seq.sequence;
      detectedCount = seq.count;
    }

    return { isLoop, sequence: detectedSequence, count: detectedCount };
  }

  /**
   * Get current action history.
   */
  getHistory(): string[] {
    return [...this.actionHistory];
  }

  /**
   * Reset detector state.
   */
  reset(): void {
    this.sequences.clear();
    this.actionHistory = [];
  }
}
