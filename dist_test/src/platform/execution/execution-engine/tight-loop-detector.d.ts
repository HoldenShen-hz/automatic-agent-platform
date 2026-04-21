/**
 * @fileoverview Tight-Loop Detector - Detects and prevents repetitive agent behavior.
 *
 * A "tight loop" (or "doom loop") occurs when an agent repeatedly executes the same
 * tool with similar or identical inputs, making no progress. This detector identifies
 * three types of loops:
 *
 * - Exact loops: Same tool called with identical inputs repeatedly
 * - Similar loops: Same tool called with inputs that differ only in formatting/ordering
 * - Sequential loops: Same sequence of tool calls repeating
 *
 * Detection operates at runtime without external storage, making it lightweight and fast.
 * When loops are detected, the system can warn or escalate (typically halting execution)
 * to prevent infinite loops from consuming resources.
 *
 * The detector uses bounded Maps to prevent unbounded memory growth, evicting
 * oldest patterns when the limit is reached.
 *
 * @see AGENT-25: Tighten doom loop / repeat call detection
 */
/**
 * Represents a detected loop pattern.
 *
 * Tracks the tool name, type of pattern detected, input hashes for matching,
 * occurrence counts, timestamps, and whether escalation has been triggered.
 */
export interface TightLoopPattern {
    toolName: string;
    /** Pattern type distinguishes exact, similar, and sequential detection modes. */
    patternType: "exact" | "similar" | "sequential";
    inputHash: string;
    inputSummary: string;
    count: number;
    firstSeen: string;
    lastSeen: string;
    /** Escalated patterns have exceeded the escalateThreshold and typically trigger termination. */
    escalated: boolean;
    recentInputs: string[];
}
/**
 * Configuration thresholds for loop detection.
 *
 * All thresholds are configurable to allow tuning for different workloads.
 * Higher warn/escalate thresholds delay detection; lower thresholds catch loops faster.
 */
export interface TightLoopConfig {
    warnThreshold?: number;
    escalateThreshold?: number;
    similarInputThreshold?: number;
    sequenceWindowSize?: number;
    sequenceRepeatThreshold?: number;
}
/**
 * Detects tight loops in agent tool call patterns.
 *
 * Maintains two pattern maps: exactPatterns (keyed by tool:inputHash) and
 * similarPatterns (keyed by tool:similarityHash). Also tracks a sliding
 * window of action sequences to detect sequential loops.
 *
 * Memory is bounded by MAX_PATTERNS to prevent unbounded growth during
 * long-running agents.
 */
export declare class TightLoopDetector {
    private exactPatterns;
    private similarPatterns;
    private actionSequence;
    private config;
    private static readonly MAX_PATTERNS;
    constructor(config?: TightLoopConfig);
    /**
     * Records a tool call and checks for loop patterns.
     *
     * Returns the detected pattern (if any), the action to take:
     * - "continue": Normal operation, loop not detected
     * - "warn": Loop pattern detected but below escalation threshold
     * - "escalate": Loop exceeded escalate threshold, execution should halt
     *
     * Also returns the pattern type for observability.
     */
    recordToolCall(toolName: string, input: unknown): {
        pattern: TightLoopPattern | null;
        action: "continue" | "warn" | "escalate";
        patternType: "exact" | "similar" | "sequential" | null;
    };
    /**
     * Checks for sequential loop patterns.
     *
     * Analyzes a sliding window of recent tool calls to detect when the same
     * sequence of actions repeats. Useful for catching loops where individual
     * calls differ slightly but the overall pattern is repetitive.
     *
     * Returns whether a loop was detected, the repeated sequence, its count,
     * and the recommended action based on repeat count vs thresholds.
     */
    checkSequentialLoop(): {
        isLoop: boolean;
        sequence: string[];
        count: number;
        action: "continue" | "warn" | "escalate";
    };
    getPatterns(): TightLoopPattern[];
    getEscalatedPatterns(): TightLoopPattern[];
    getWarnPatterns(): TightLoopPattern[];
    reset(): void;
    getConfig(): Readonly<Required<TightLoopConfig>>;
    getSequenceHistory(): string[];
}
export declare function createTightLoopDetector(config?: TightLoopConfig): TightLoopDetector;
