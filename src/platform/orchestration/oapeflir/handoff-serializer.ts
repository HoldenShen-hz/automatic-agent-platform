/**
 * Agent Handoff Serializer — GAP-V2-05
 *
 * Implements L1→L2→L3 layered serialization with token budget trimming.
 *
 * Layer semantics (per §12 Agent Handoff Protocol):
 * - L1 (Fact Layer): Immutable ground truth — artifact refs + tool call records.
 *                     Always preserved unless budget exhausted.
 * - L2 (State Layer): Mutable execution context — phase, blockers, remaining budget,
 *                     latest summary. Trimmed aggressively when over budget.
 * - L3 (Plan Delta):  Changes to the plan since handoff was initiated.
 *                     Most volatile, trimmed first.
 *
 * Budget trimming priority: L3 → L2.summary → L2.blockers → L1.toolCallRecords → L1.artifactRefs
 */

import type { AgentHandoff, FactLayer, StateLayer, PlanDelta } from "./handoff-model.js";

export interface HandoffSerializerOptions {
  /** Hard token cap for the serialized handoff payload. */
  totalMaxTokens: number;
}

/**
 * Token estimation (rough: 4 chars ≈ 1 token).
 */
function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}

/**
 * Serializes an AgentHandoff with L1→L2→L3 priority and budget trimming.
 *
 * L1 (Fact Layer) is the most critical — preserved longest.
 * L2 (State Layer) provides execution context — trimmed after L3.
 * L3 (Plan Delta) is most volatile — trimmed first.
 *
 * @returns A budget-trimmed AgentHandoff suitable for passing to the next agent.
 */
export function serializeHandoff(handoff: AgentHandoff, options: HandoffSerializerOptions): AgentHandoff {
  const clone = structuredClone(handoff);
  let size = estimateTokens(clone);

  // Fits within budget — return as-is
  if (size <= options.totalMaxTokens) {
    return clone;
  }

  // Phase 1: Trim L3 (Plan Delta) — most volatile
  const trimmedL3 = trimPlanDelta(clone.planDelta);
  const l3Saved = estimateTokens(clone.planDelta) - estimateTokens(trimmedL3);
  clone.planDelta = trimmedL3;
  size -= l3Saved;
  if (size <= options.totalMaxTokens) {
    return clone;
  }

  // Phase 2: Trim L2 (State Layer) — aggressive but preserve identity
  const trimmedL2 = trimStateLayer(clone.state);
  const l2Saved = estimateTokens(clone.state) - estimateTokens(trimmedL2);
  clone.state = trimmedL2;
  size -= l2Saved;
  if (size <= options.totalMaxTokens) {
    return clone;
  }

  // Phase 3: Trim L1.toolCallRecords — detailed but replaceable
  clone.fact = { ...clone.fact, toolCallRecords: [] };
  size = estimateTokens(clone);
  if (size <= options.totalMaxTokens) {
    return clone;
  }

  // Phase 4: Trim L1.artifactRefs
  clone.fact.artifactRefs = clone.fact.artifactRefs.slice(0, 3);
  size = estimateTokens(clone);
  if (size <= options.totalMaxTokens) {
    return clone;
  }

  // Phase 5: Final fallback — strip to identity only
  return minimalHandoff(clone);
}

/**
 * Trims PlanDelta by removing detailed change records first.
 */
function trimPlanDelta(delta: PlanDelta): PlanDelta {
  const clone: PlanDelta = JSON.parse(JSON.stringify(delta)) as PlanDelta;

  // Remove detailed change records (most verbose)
  clone.changedSteps = [];
  let size = estimateTokens(clone);
  if (size <= estimateTokens(clone) * 0.7) {
    return clone;
  }

  // Remove removedSteps (already handled, high value)
  clone.removedSteps = [];
  return clone;
}

/**
 * Trims StateLayer by clearing summary and limiting blockers.
 */
function trimStateLayer(state: StateLayer): StateLayer {
  const clone: StateLayer = JSON.parse(JSON.stringify(state)) as StateLayer;

  // Clear latestSummary (most verbose string field)
  clone.latestSummary = truncateString(clone.latestSummary, 200);
  if (estimateTokens(clone) <= estimateTokens(state) * 0.8) {
    return clone;
  }

  // Limit blockers to top 3
  clone.blockers = clone.blockers.slice(0, 3);
  if (estimateTokens(clone) <= estimateTokens(state) * 0.6) {
    return clone;
  }

  // Clear summary entirely
  clone.latestSummary = "";
  return clone;
}

/**
 * Returns a minimal handoff with only identity fields.
 */
function minimalHandoff(original: AgentHandoff): AgentHandoff {
  return {
    handoffId: original.handoffId,
    taskId: original.taskId,
    fromAgentId: original.fromAgentId,
    toAgentId: original.toAgentId,
    createdAt: original.createdAt,
    fact: {
      artifactRefs: [],
      toolCallRecords: [],
    },
    state: {
      currentPhase: original.state.currentPhase,
      blockers: [],
      remainingBudgetUsd: original.state.remainingBudgetUsd,
      latestSummary: "",
    },
    planDelta: {
      addedSteps: [],
      removedSteps: [],
      changedSteps: [],
    },
    primaryRefs: original.primaryRefs.slice(0, 1),
  };
}

function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen) + "…";
}
