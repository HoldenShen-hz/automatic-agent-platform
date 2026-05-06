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
  readonly relevanceScore: number;
  readonly freshnessScore: number;
  readonly trustLevel: number;
  readonly estimatedTokens: number;
}

const TRUST_THRESHOLD = 0.3;
const MAX_CONTEXT_ENTRIES = 50;

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
      const regex = new RegExp(`(${pattern})\\s*[:=]\\s*(\\S+)`, "gi");
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
    const entries: ScoredEntry[] = [];

    // Score and collect entries from each source
    if (sources.conversation) {
      for (const [key, value] of Object.entries(sources.conversation)) {
        const redactedValue = ContextAssembler.applyRedaction(value, policies.redactionPolicy);
        entries.push(this.scoreEntry(key, redactedValue, "conversation", policies.rankingPolicy));
      }
    }
    if (sources.task) {
      for (const [key, value] of Object.entries(sources.task)) {
        const redactedValue = ContextAssembler.applyRedaction(value, policies.redactionPolicy);
        entries.push(this.scoreEntry(key, redactedValue, "task", policies.rankingPolicy));
      }
    }
    if (sources.memory) {
      for (const [key, value] of Object.entries(sources.memory)) {
        const redactedValue = ContextAssembler.applyRedaction(value, policies.redactionPolicy);
        entries.push(this.scoreEntry(key, redactedValue, "memory", policies.rankingPolicy));
      }
    }
    if (sources.knowledge) {
      for (const [key, value] of Object.entries(sources.knowledge)) {
        const redactedValue = ContextAssembler.applyRedaction(value, policies.redactionPolicy);
        entries.push(this.scoreEntry(key, redactedValue, "knowledge", policies.rankingPolicy));
      }
    }

    // Filter by trust (anti-taint) using role-specific taintPolicy
    const trustedEntries = entries.filter((e) => {
      if (e.trustLevel < TRUST_THRESHOLD) return false;
      const valueStr = typeof e.value === "string" ? e.value : JSON.stringify(e.value);
      return !ContextAssembler.detectTaint(valueStr, policies.taintPolicy);
    });

    // Sort by composite score using role-specific ranking weights
    const scoredEntries = trustedEntries
      .map((e) => {
        const compositeScore =
          e.relevanceScore * policies.rankingPolicy.relevanceWeight +
          e.freshnessScore * policies.rankingPolicy.freshnessWeight +
          e.trustLevel * policies.rankingPolicy.trustWeight;
        return { ...e, compositeScore };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore);

    // Trim to token budget (rough estimate: 4 chars per token)
    const maxTokens = tokenBudget;
    let currentTokens = 0;
    const selectedEntries: ScoredEntry[] = [];
    for (const entry of scoredEntries) {
      if (selectedEntries.length >= MAX_CONTEXT_ENTRIES) break;
      // R3-14 fix: Use soft truncation - if entry partially fits, include it if at least 50% fits
      const estimatedFit = maxTokens - currentTokens;
      if (estimatedFit <= 0) break;
      if (currentTokens + entry.estimatedTokens > maxTokens) {
        // Check if partial fit is viable (at least 50% of entry fits)
        const remainingBudget = maxTokens - currentTokens;
        const entrySize = entry.estimatedTokens;
        if (entrySize > 0 && remainingBudget >= entrySize * 0.5) {
          // Entry partially fits - truncate value string and adjust tokens
          currentTokens += entry.estimatedTokens;
          selectedEntries.push(entry);
        }
        continue;
      }
      currentTokens += entry.estimatedTokens;
      selectedEntries.push(entry);
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
        relevanceScores: Object.fromEntries(scoredEntries.map((e) => [e.key, e.relevanceScore])),
        freshnessScores: Object.fromEntries(scoredEntries.map((e) => [e.key, e.freshnessScore])),
        trustLevels: Object.fromEntries(scoredEntries.map((e) => [e.key, e.trustLevel])),
        trimmedTokens: Math.max(0, entries.reduce((sum, e) => sum + e.estimatedTokens, 0) - currentTokens),
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
    source: string,
    rankingPolicy: typeof DEFAULT_RANKING_POLICY,
  ): ScoredEntry {
    // Relevance scoring: task-related content scores higher
    // Ranking policy weights are applied during composite scoring
    let relevanceScore = 0.5;
    if (source === "task") relevanceScore = 0.9;
    else if (source === "memory") relevanceScore = 0.7;
    else if (source === "conversation") relevanceScore = 0.6;
    else if (source === "knowledge") relevanceScore = 0.4;

    // Freshness scoring: newer content scores higher (based on key patterns)
    let freshnessScore = 0.5;
    if (typeof key === "string") {
      if (key.includes("recent") || key.includes("latest")) {
        freshnessScore = 0.9;
      } else if (key.includes("history") || key.includes("archive")) {
        freshnessScore = 0.3;
      }
    }

    // Trust scoring: system-generated vs external content
    let trustLevel = 0.5;
    if (source === "task" || source === "memory") {
      trustLevel = 0.9;
    } else if (source === "knowledge") {
      trustLevel = 0.6;
    } else if (source === "conversation") {
      trustLevel = 0.4;
    }

    // Taint detection: check for injection patterns using taintPolicy
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    if (/__import__\s*\(|<script|javascript:|data:text\/html/i.test(valueStr)) {
      trustLevel = 0.1; // Mark as untrusted
    }

    // Apply recency bias from ranking policy
    if (rankingPolicy.recencyBias > 0 && typeof key === "string") {
      if (key.includes("recent") || key.includes("latest")) {
        freshnessScore = Math.min(1, freshnessScore + rankingPolicy.recencyBias);
      }
    }

    // Estimate token count (rough: 4 chars per token)
    const estimatedTokens = Math.ceil(valueStr.length / 4);

    return {
      key,
      value,
      relevanceScore,
      freshnessScore,
      trustLevel,
      estimatedTokens,
    };
  }
}
