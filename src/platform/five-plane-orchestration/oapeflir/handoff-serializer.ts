import {
  HANDOFF_LEVEL_TOKEN_BUDGET,
  compactAgentHandoff,
  type AgentHandoff,
  type HandoffBudgetOptions,
  type HandoffLevel,
} from "./handoff-model.js";

export interface HandoffSerializerOptions extends HandoffBudgetOptions {}

export function resolveHandoffLevel(options: HandoffSerializerOptions = {}): HandoffLevel {
  return options.level ?? "L3_facts_plan_delta";
}

export function projectHandoffForLevel(handoff: AgentHandoff, level: HandoffLevel): AgentHandoff {
  const clone = structuredClone(handoff);

  if (level === "L4_full") {
    return clone;
  }

  if (level === "L3_facts_plan_delta") {
    clone.historyRefs = [];
    return clone;
  }

  if (level === "L2_state_delta") {
    clone.fact.artifactRefs = [];
    clone.fact.toolCallRecords = [];
    clone.planDelta = {
      addedSteps: [],
      removedSteps: [],
      changedSteps: [],
    };
    clone.historyRefs = [];
    return clone;
  }

  clone.state.latestSummary = clone.contextSummary;
  clone.fact.artifactRefs = [];
  clone.fact.toolCallRecords = [];
  clone.planDelta = {
    addedSteps: [],
    removedSteps: [],
    changedSteps: [],
  };
  clone.historyRefs = [];
  return clone;
}

export function serializeHandoff(
  handoff: AgentHandoff,
  options: HandoffSerializerOptions = {},
): AgentHandoff {
  const level = resolveHandoffLevel(options);
  const projected = projectHandoffForLevel(handoff, level);
  return compactAgentHandoff(projected, {
    ...options,
    totalMaxTokens: options.totalMaxTokens
      ?? options.levelTokenBudgets?.[level]
      ?? HANDOFF_LEVEL_TOKEN_BUDGET[level],
  });
}

export function minimalHandoff(original: AgentHandoff): AgentHandoff {
  return {
    handoffId: original.handoffId,
    taskId: original.taskId,
    fromAgentId: original.fromAgentId,
    toAgentId: original.toAgentId,
    createdAt: original.createdAt,
    contextSummary: original.contextSummary,
    fact: {
      artifactRefs: [],
      toolCallRecords: [],
    },
    state: {
      currentPhase: original.state.currentPhase,
      blockers: [],
      remainingBudgetUsd: original.state.remainingBudgetUsd,
      latestSummary: original.contextSummary,
    },
    planDelta: {
      addedSteps: [],
      removedSteps: [],
      changedSteps: [],
    },
    primaryRefs: original.primaryRefs.slice(0, 1),
    historyRefs: [],
  };
}
