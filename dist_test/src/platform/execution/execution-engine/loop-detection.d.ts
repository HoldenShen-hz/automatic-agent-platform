/**
 * @fileoverview Doom Loop Detection - Prevents infinite repetition loops.
 *
 * Detects repeated tool calls with same normalized input using hash.
 * - 3 occurrences: warn/ask
 * - 5 occurrences: escalate/terminate
 */
import type { BeforeAgentHook, WrapToolCallHook } from "./agent-middleware-chain.js";
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
export declare function normalizeToolInputForHash(input: unknown): string;
/**
 * Creates a hash of the tool call for loop detection.
 */
export declare function hashToolCall(toolName: string, input: unknown): string;
/**
 * Loop detection state manager.
 */
export declare class LoopDetectionState {
    private patterns;
    private config;
    private readonly PATTERN_TTL_MS;
    private readonly MAX_PATTERNS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    constructor(config?: LoopDetectionConfig);
    /**
     * C-11: Evict expired loop patterns to prevent memory leaks.
     */
    private evictExpiredPatterns;
    /**
     * Record a tool call and check for loops.
     */
    recordToolCall(toolName: string, input: unknown): {
        pattern: LoopPattern;
        action: "continue" | "warn" | "escalate";
    };
    /**
     * Get all current loop patterns.
     */
    getPatterns(): LoopPattern[];
    /**
     * Get patterns that have escalated.
     */
    getEscalatedPatterns(): LoopPattern[];
    /**
     * Get current repeat count for a tool call.
     */
    getRepeatCount(toolName: string, input: unknown): number;
    /**
     * Check if a tool call would trigger escalation.
     */
    wouldEscalate(toolName: string, input: unknown): boolean;
    /**
     * Clear all patterns.
     */
    reset(): void;
    /**
     * Remove a specific pattern.
     */
    removePattern(toolName: string, input: unknown): void;
    /**
     * Get configuration.
     */
    getConfig(): Readonly<Required<LoopDetectionConfig>>;
}
/**
 * Creates a before_agent middleware hook for loop detection.
 */
export declare function createLoopDetectionMiddleware(config?: LoopDetectionConfig): {
    middleware: BeforeAgentHook;
    state: LoopDetectionState;
};
export interface LoopDetectionMiddlewareSet {
    beforeAgent: BeforeAgentHook;
    wrapToolCall: WrapToolCallHook;
    state: LoopDetectionState;
}
export declare function createLoopDetectionMiddlewareFull(config?: LoopDetectionConfig): LoopDetectionMiddlewareSet;
/**
 * Doom loop detection for repeated same-action sequences.
 */
export interface SequenceLoopDetectionConfig {
    /** Window size for sequence analysis (default: 5) */
    windowSize?: number;
    /** Threshold for same-sequence repeats (default: 3) */
    repeatThreshold?: number;
}
export declare class SequenceLoopDetector {
    private sequences;
    private actionHistory;
    private config;
    constructor(config?: SequenceLoopDetectionConfig);
    /**
     * Record an action and check for sequence loops.
     */
    recordAction(action: string): {
        isLoop: boolean;
        sequence: string[];
        count: number;
    };
    /**
     * Get current action history.
     */
    getHistory(): string[];
    /**
     * Reset detector state.
     */
    reset(): void;
}
