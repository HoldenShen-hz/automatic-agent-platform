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

import { createHash } from "node:crypto";
import { nowIso } from "../../contracts/types/ids.js";

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
 * Normalizes input for comparison by type.
 *
 * Strings are trimmed and lowercased. Objects are JSON-serialized with sorted keys
 * to ensure {a:1, b:2} and {b:2, a:1} produce the same normalized value. This enables
 * similar input detection to catch loops where argument order differs.
 */
function normalizeInputForComparison(input: unknown): string {
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

/** Computes a 16-character hash of tool name + normalized input for exact matching. */
function computeHash(toolName: string, normalizedInput: string): string {
  return createHash("sha256").update(`${toolName}:${normalizedInput}`).digest("hex").slice(0, 16);
}

/**
 * Computes a 12-character hash of the words in normalized input for similarity matching.
 *
 * Sorts words alphabetically before hashing so that inputs like "read file X then write"
 * and "write file X then read" produce the same similarity hash, catching loops where
 * order changes but the core inputs remain similar.
 */
function computeSimilarityHash(normalizedInput: string): string {
  const words = normalizedInput.split(/\s+/).filter(Boolean);
  words.sort();
  return createHash("sha256").update(words.join(":")).digest("hex").slice(0, 12);
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
export class TightLoopDetector {
  private exactPatterns: Map<string, TightLoopPattern> = new Map();
  private similarPatterns: Map<string, TightLoopPattern> = new Map();
  private actionSequence: string[] = [];
  private config: Required<TightLoopConfig>;
  // C-12: Max size bounds to prevent unbounded memory growth
  private static readonly MAX_PATTERNS = 500;

  public constructor(config: TightLoopConfig = {}) {
    this.config = {
      warnThreshold: config.warnThreshold ?? 3,
      escalateThreshold: config.escalateThreshold ?? 5,
      similarInputThreshold: config.similarInputThreshold ?? 0.8,
      sequenceWindowSize: config.sequenceWindowSize ?? 5,
      sequenceRepeatThreshold: config.sequenceRepeatThreshold ?? 3,
    };
  }

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
  public recordToolCall(
    toolName: string,
    input: unknown,
  ): { pattern: TightLoopPattern | null; action: "continue" | "warn" | "escalate"; patternType: "exact" | "similar" | "sequential" | null } {
    const normalized = normalizeInputForComparison(input);
    const inputSummary = normalized.slice(0, 100);
    const exactHash = computeHash(toolName, normalized);
    const similarHash = computeSimilarityHash(normalized);
    const sequenceKey = `${toolName}:${exactHash}`;
    const now = nowIso();

    this.actionSequence.push(sequenceKey);
    if (this.actionSequence.length > this.config.sequenceWindowSize * 2) {
      this.actionSequence = this.actionSequence.slice(-this.config.sequenceWindowSize);
    }

    const exactPattern = this.exactPatterns.get(sequenceKey);
    if (exactPattern) {
      exactPattern.count++;
      exactPattern.lastSeen = now;
      if (exactPattern.recentInputs.length < 5) {
        exactPattern.recentInputs.push(inputSummary);
      }

      if (exactPattern.count >= this.config.escalateThreshold) {
        exactPattern.escalated = true;
        return { pattern: exactPattern, action: "escalate", patternType: "exact" };
      }
      if (exactPattern.count >= this.config.warnThreshold) {
        return { pattern: exactPattern, action: "warn", patternType: "exact" };
      }
      return { pattern: exactPattern, action: "continue", patternType: "exact" };
    }

    const similarPattern = this.similarPatterns.get(`${toolName}:${similarHash}`);
    if (similarPattern) {
      similarPattern.count++;
      similarPattern.lastSeen = now;
      if (similarPattern.recentInputs.length < 5) {
        similarPattern.recentInputs.push(inputSummary);
      }

      if (similarPattern.count >= this.config.escalateThreshold) {
        similarPattern.escalated = true;
        return { pattern: similarPattern, action: "escalate", patternType: "similar" };
      }
      if (similarPattern.count >= this.config.warnThreshold) {
        return { pattern: similarPattern, action: "warn", patternType: "similar" };
      }
      return { pattern: similarPattern, action: "continue", patternType: "similar" };
    }

    const newPattern: TightLoopPattern = {
      toolName,
      patternType: "exact",
      inputHash: exactHash,
      inputSummary,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      escalated: false,
      recentInputs: [inputSummary],
    };
    if (this.exactPatterns.size >= TightLoopDetector.MAX_PATTERNS) {
      const oldest = this.exactPatterns.keys().next().value;
      if (oldest != null) this.exactPatterns.delete(oldest);
    }
    this.exactPatterns.set(sequenceKey, newPattern);

    const newSimilarPattern: TightLoopPattern = {
      toolName,
      patternType: "similar",
      inputHash: similarHash,
      inputSummary,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      escalated: false,
      recentInputs: [inputSummary],
    };
    if (this.similarPatterns.size >= TightLoopDetector.MAX_PATTERNS) {
      const oldest = this.similarPatterns.keys().next().value;
      if (oldest != null) this.similarPatterns.delete(oldest);
    }
    this.similarPatterns.set(`${toolName}:${similarHash}`, newSimilarPattern);

    return { pattern: null, action: "continue", patternType: null };
  }

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
  public checkSequentialLoop(): { isLoop: boolean; sequence: string[]; count: number; action: "continue" | "warn" | "escalate" } {
    if (this.actionSequence.length < this.config.sequenceWindowSize) {
      return { isLoop: false, sequence: [], count: 0, action: "continue" };
    }

    const windowStart = this.actionSequence.length - this.config.sequenceWindowSize;
    const currentWindow = this.actionSequence.slice(windowStart);
    const sequenceKey = currentWindow.join("|");

    const sequenceCounts = new Map<string, { sequence: string[]; count: number }>();

    for (let i = 0; i <= this.actionSequence.length - this.config.sequenceWindowSize; i++) {
      const window = this.actionSequence.slice(i, i + this.config.sequenceWindowSize);
      const key = window.join("|");
      const existing = sequenceCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        sequenceCounts.set(key, { sequence: window, count: 1 });
      }
    }

    const match = sequenceCounts.get(sequenceKey);
    if (match && match.count >= this.config.sequenceRepeatThreshold) {
      const action: "continue" | "warn" | "escalate" =
        match.count >= this.config.escalateThreshold ? "escalate" :
        match.count >= this.config.warnThreshold ? "warn" : "continue";
      return { isLoop: true, sequence: currentWindow, count: match.count, action };
    }

    return { isLoop: false, sequence: [], count: 0, action: "continue" };
  }

  public getPatterns(): TightLoopPattern[] {
    return [...this.exactPatterns.values(), ...this.similarPatterns.values()];
  }

  public getEscalatedPatterns(): TightLoopPattern[] {
    return this.getPatterns().filter((p) => p.escalated);
  }

  public getWarnPatterns(): TightLoopPattern[] {
    return this.getPatterns().filter((p) => !p.escalated && p.count >= this.config.warnThreshold);
  }

  public reset(): void {
    this.exactPatterns.clear();
    this.similarPatterns.clear();
    this.actionSequence = [];
  }

  public getConfig(): Readonly<Required<TightLoopConfig>> {
    return { ...this.config };
  }

  public getSequenceHistory(): string[] {
    return [...this.actionSequence];
  }
}

export function createTightLoopDetector(config?: TightLoopConfig): TightLoopDetector {
  return new TightLoopDetector(config);
}
