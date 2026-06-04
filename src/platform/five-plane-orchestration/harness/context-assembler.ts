import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import type { ContextSnapshot } from "./index.js";
import type { HarnessRunRuntimeState } from "./index.js";
import { DEFAULT_TAINT_POLICY, DEFAULT_RANKING_POLICY, DEFAULT_REDACTION_POLICY } from "./index.js";
import type { HarnessRole } from "./index.js";

export interface HarnessContextSourceSet {
  readonly conversation?: Readonly<Record<string, unknown>>;
  readonly task?: Readonly<Record<string, unknown>>;
  readonly memory?: Readonly<Record<string, unknown>>;
  readonly knowledge?: Readonly<Record<string, unknown>>;
}

export interface HarnessContext {
  readonly contextId: string;
  readonly tokenBudget: number;
  readonly conversation: Readonly<Record<string, unknown>>;
  readonly task: Readonly<Record<string, unknown>>;
  readonly memory: Readonly<Record<string, unknown>>;
  readonly knowledge: Readonly<Record<string, unknown>>;
  readonly assembledAt: string;
  readonly metadata?: Readonly<{
    readonly relevanceScores?: Readonly<Record<string, number>>;
    readonly freshnessScores?: Readonly<Record<string, number>>;
    readonly trustLevels?: Readonly<Record<string, number>>;
    readonly trimmedTokens?: number;
  }>;
}

interface ScoredEntry {
  readonly key: string;
  readonly value: unknown;
  readonly serializedValue: string;
  readonly sourceBucket: "conversation" | "task" | "memory" | "knowledge";
  readonly relevanceScore: number;
  readonly freshnessScore: number;
  readonly trustLevel: number;
  readonly estimatedTokens: number;
  readonly compositeScore: number;
}

const TRUST_THRESHOLD = 0.3;
const MAX_CONTEXT_ENTRIES = 50;
const REDACTION_REGEX_CACHE = new Map<string, RegExp>();
const INJECTION_PATTERN = /__import__\s*\(|<script|javascript:|data:text\/html/i;

export class ContextAssembler {
  /**
   * Per-role policy selectors per §45.23 ContextAssemblyContract.
   * Each role can have different taintPolicy/rankingPolicy/redactionPolicy.
   */
  private static getRolePolicies(role?: HarnessRole): {
    taintPolicy: typeof DEFAULT_TAINT_POLICY;
    rankingPolicy: typeof DEFAULT_RANKING_POLICY;
    redactionPolicy: typeof DEFAULT_REDACTION_POLICY;
  } {
    // Default policies apply to all roles unless overridden
    // Roles with elevated trust get more permissive taint detection
    switch (role) {
      case "planner":
        // Planner needs access to domain/shared memory but stricter output guard
        return {
          taintPolicy: { ...DEFAULT_TAINT_POLICY, blockedPatterns: [...DEFAULT_TAINT_POLICY.blockedPatterns, "override_system"] },
          rankingPolicy: { ...DEFAULT_RANKING_POLICY, relevanceWeight: 0.6, freshnessWeight: 0.2 },
          redactionPolicy: DEFAULT_REDACTION_POLICY,
        };
      case "generator":
        // Generator needs creative flexibility but strict content filtering
        return {
          taintPolicy: DEFAULT_TAINT_POLICY,
          rankingPolicy: { ...DEFAULT_RANKING_POLICY, relevanceWeight: 0.7, trustWeight: 0.1 },
          redactionPolicy: { ...DEFAULT_REDACTION_POLICY, redactPatterns: [...DEFAULT_REDACTION_POLICY.redactPatterns, "internal_endpoint"] },
        };
      case "evaluator":
        // Evaluator needs maximum transparency, minimum redaction
        return {
          taintPolicy: { ...DEFAULT_TAINT_POLICY, requireSanitization: false },
          rankingPolicy: { ...DEFAULT_RANKING_POLICY, trustWeight: 0.4, relevanceWeight: 0.3 },
          redactionPolicy: { ...DEFAULT_REDACTION_POLICY, redactPatterns: [] },
        };
      case "hitl_operator":
        // HITL operator needs full context for human review
        return {
          taintPolicy: { ...DEFAULT_TAINT_POLICY, requireSanitization: false },
          rankingPolicy: DEFAULT_RANKING_POLICY,
          redactionPolicy: { ...DEFAULT_REDACTION_POLICY, redactPatterns: [] },
        };
      case "loop_controller":
        // Loop controller needs operational metrics, minimal personal data
        return {
          taintPolicy: DEFAULT_TAINT_POLICY,
          rankingPolicy: { ...DEFAULT_RANKING_POLICY, relevanceWeight: 0.4, freshnessWeight: 0.4 },
          redactionPolicy: { ...DEFAULT_REDACTION_POLICY, redactPatterns: [...DEFAULT_REDACTION_POLICY.redactPatterns, "session_id", "user_id"] },
        };
      case "learner":
        // Learner needs historical patterns, can handle more context
        return {
          taintPolicy: DEFAULT_TAINT_POLICY,
          rankingPolicy: { ...DEFAULT_RANKING_POLICY, freshnessWeight: 0.5, recencyBias: 0.2 },
          redactionPolicy: DEFAULT_REDACTION_POLICY,
        };
      case "release_manager":
        // Release manager needs compliance data, strict audit trail
        return {
          taintPolicy: DEFAULT_TAINT_POLICY,
          rankingPolicy: { ...DEFAULT_RANKING_POLICY, trustWeight: 0.3 },
          redactionPolicy: { ...DEFAULT_REDACTION_POLICY, redactPatterns: [...DEFAULT_REDACTION_POLICY.redactPatterns, "api_key", "token", "credential"] },
        };
      default:
        return {
          taintPolicy: DEFAULT_TAINT_POLICY,
          rankingPolicy: DEFAULT_RANKING_POLICY,
          redactionPolicy: DEFAULT_REDACTION_POLICY,
        };
    }
  }

  /**
   * Apply taint detection based on role-specific taintPolicy.
   * Returns true if the entry should be blocked.
   */
  private static detectTaint(valueStr: string, taintPolicy: typeof DEFAULT_TAINT_POLICY): boolean {
    for (const pattern of taintPolicy.blockedPatterns) {
      if (valueStr.includes(pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Apply redaction based on role-specific redactionPolicy.
   * Returns redacted value if any patterns match.
   */
  private static applyRedaction(value: unknown, redactionPolicy: typeof DEFAULT_REDACTION_POLICY): unknown {
    if (typeof value !== "string") {
      return value;
    }
    let redacted = value;
    for (const pattern of redactionPolicy.redactPatterns) {
      const regex = getCachedRedactionRegex(pattern);
      redacted = redacted.replace(regex, `$1: ${redactionPolicy.replacementMask}`);
    }
    return redacted;
  }

  /**
   * Assemble context with per-role isolation per §45.23 ContextAssemblyContract.
   * Each role (planner/generator/evaluator/hitl_operator/loop_controller/learner/release_manager)
   * gets context assembled with role-specific taintPolicy, rankingPolicy, and redactionPolicy.
   */
  public assemble(
    sources: HarnessContextSourceSet,
    tokenBudget: number,
    role?: HarnessRole,
  ): HarnessContext {
    const policies = ContextAssembler.getRolePolicies(role);
    const scoredEntries: ScoredEntry[] = [];
    const relevanceScores: Record<string, number> = {};
    const freshnessScores: Record<string, number> = {};
    const trustLevels: Record<string, number> = {};
    let totalEntryTokens = 0;

    const collectEntries = (
      source: Readonly<Record<string, unknown>> | undefined,
      sourceBucket: "conversation" | "task" | "memory" | "knowledge",
    ): void => {
      if (source == null) {
        return;
      }
      for (const [key, value] of Object.entries(source)) {
        const redactedValue = ContextAssembler.applyRedaction(value, policies.redactionPolicy);
        const entry = this.scoreEntry(key, redactedValue, sourceBucket, policies.rankingPolicy);
        totalEntryTokens += entry.estimatedTokens;
        if (entry.trustLevel < TRUST_THRESHOLD || ContextAssembler.detectTaint(entry.serializedValue, policies.taintPolicy)) {
          continue;
        }
        relevanceScores[entry.key] = entry.relevanceScore;
        freshnessScores[entry.key] = entry.freshnessScore;
        trustLevels[entry.key] = entry.trustLevel;
        scoredEntries.push(entry);
      }
    };

    collectEntries(sources.conversation, "conversation");
    collectEntries(sources.task, "task");
    collectEntries(sources.memory, "memory");
    collectEntries(sources.knowledge, "knowledge");

    // Trim to token budget (rough estimate: 4 chars per token)
    const maxTokens = tokenBudget;
    let currentTokens = 0;
    let selectedEntries = scoredEntries;

    if (scoredEntries.length > MAX_CONTEXT_ENTRIES || totalEntryTokens > maxTokens) {
      selectedEntries = [...scoredEntries].sort((a, b) => b.compositeScore - a.compositeScore);
      const trimmedSelection: ScoredEntry[] = [];
      for (const entry of selectedEntries) {
        if (trimmedSelection.length >= MAX_CONTEXT_ENTRIES) {
          break;
        }
        const estimatedFit = maxTokens - currentTokens;
        if (estimatedFit <= 0) {
          break;
        }
        if (currentTokens + entry.estimatedTokens > maxTokens) {
          const remainingBudget = maxTokens - currentTokens;
          const entrySize = entry.estimatedTokens;
          if (entrySize > 0 && remainingBudget >= entrySize * 0.5) {
            currentTokens += entry.estimatedTokens;
            trimmedSelection.push(entry);
          }
          continue;
        }
        currentTokens += entry.estimatedTokens;
        trimmedSelection.push(entry);
      }
      selectedEntries = trimmedSelection;
    } else {
      currentTokens = totalEntryTokens;
    }

    // Reconstruct context from selected entries
    const conversation: Record<string, unknown> = {};
    const task: Record<string, unknown> = {};
    const memory: Record<string, unknown> = {};
    const knowledge: Record<string, unknown> = {};

    for (const entry of selectedEntries) {
      if (entry.key.startsWith("conv:")) {
        conversation[entry.key] = entry.value;
      } else if (entry.key.startsWith("task:")) {
        task[entry.key] = entry.value;
      } else if (entry.key.startsWith("mem:")) {
        memory[entry.key] = entry.value;
      } else if (entry.key.startsWith("know:")) {
        knowledge[entry.key] = entry.value;
      } else {
        // Default assignment
        task[entry.key] = entry.value;
      }
    }

    return {
      contextId: newId("harness_context"),
      tokenBudget,
      conversation,
      task,
      memory,
      knowledge,
      assembledAt: nowIso(),
      metadata: {
        relevanceScores,
        freshnessScores,
        trustLevels,
        trimmedTokens: Math.max(0, totalEntryTokens - currentTokens),
      },
    };
  }

  public snapshot(run: HarnessRunRuntimeState, context: HarnessContext): ContextSnapshot {
    return {
      snapshotId: newId("ctx_snapshot"),
      runId: run.runId,
      domainId: run.domainId,
      iteration: run.currentIteration,
      stepCount: run.steps.length,
      lastDecisionId: run.decision?.decisionId ?? null,
      capturedAt: context.assembledAt,
    };
  }

  private scoreEntry(
    key: string,
    value: unknown,
    sourceBucket: "conversation" | "task" | "memory" | "knowledge",
    rankingPolicy: typeof DEFAULT_RANKING_POLICY,
  ): ScoredEntry {
    // Relevance scoring: task-related content scores higher
    // Ranking policy weights are applied during composite scoring
    let relevanceScore = 0.5;
    if (sourceBucket === "task") relevanceScore = 0.9;
    else if (sourceBucket === "memory") relevanceScore = 0.7;
    else if (sourceBucket === "conversation") relevanceScore = 0.6;
    else if (sourceBucket === "knowledge") relevanceScore = 0.4;

    // Freshness scoring: newer content scores higher (based on key patterns)
    let freshnessScore = 0.5;
    if (key.includes("recent") || key.includes("latest")) {
      freshnessScore = 0.9;
    } else if (key.includes("history") || key.includes("archive")) {
      freshnessScore = 0.3;
    }

    // Trust scoring: system-generated vs external content
    let trustLevel = 0.5;
    if (sourceBucket === "task" || sourceBucket === "memory") {
      trustLevel = 0.9;
    } else if (sourceBucket === "knowledge") {
      trustLevel = 0.6;
    } else if (sourceBucket === "conversation") {
      trustLevel = 0.4;
    }

    const serializedValue = typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
    if (INJECTION_PATTERN.test(serializedValue)) {
      trustLevel = 0.1; // Mark as untrusted
    }

    // Apply recency bias from ranking policy
    if (rankingPolicy.recencyBias > 0 && (key.includes("recent") || key.includes("latest"))) {
      freshnessScore = Math.min(1, freshnessScore + rankingPolicy.recencyBias);
    }

    // Estimate token count (rough: 4 chars per token)
    const estimatedTokens = Math.ceil(serializedValue.length / 4);
    const compositeScore =
      relevanceScore * rankingPolicy.relevanceWeight +
      freshnessScore * rankingPolicy.freshnessWeight +
      trustLevel * rankingPolicy.trustWeight;

    return {
      key,
      value,
      serializedValue,
      sourceBucket,
      relevanceScore,
      freshnessScore,
      trustLevel,
      estimatedTokens,
      compositeScore,
    };
  }
}

function getCachedRedactionRegex(pattern: string): RegExp {
  const cached = REDACTION_REGEX_CACHE.get(pattern);
  if (cached != null) {
    return cached;
  }
  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const compiled = new RegExp(`(${escapedPattern})\\s*[:=]\\s*(\\S+)`, "gi");
  REDACTION_REGEX_CACHE.set(pattern, compiled);
  return compiled;
}
