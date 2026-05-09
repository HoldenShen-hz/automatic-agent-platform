import { nowIso, newId } from "../../contracts/types/ids.js";
import type { ToolCallRecord } from "./tool-call-record.js";

export interface FactLayer {
  artifactRefs: string[];
  toolCallRecords: ToolCallRecord[];
}

export interface StateLayer {
  currentPhase: string;
  blockers: string[];
  remainingBudgetUsd: number | null;
  latestSummary: string;
}

export interface PlanDelta {
  addedSteps: string[];
  removedSteps: string[];
  changedSteps: Array<{ stepId: string; reason: string }>;
}

export type HandoffLevel =
  | "L1_context_summary"
  | "L2_state_delta"
  | "L3_facts_plan_delta"
  | "L4_full";

export const HANDOFF_LEVEL_TOKEN_BUDGET: Record<HandoffLevel, number> = {
  L1_context_summary: 200,
  L2_state_delta: 500,
  L3_facts_plan_delta: 2_000,
  L4_full: 8_000,
};

export interface AgentHandoff {
  handoffId: string;
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  createdAt: string;
  contextSummary: string;
  fact: FactLayer;
  state: StateLayer;
  planDelta: PlanDelta;
  primaryRefs: string[];
  historyRefs: string[];
}

export interface HandoffBudgetOptions {
  totalMaxTokens?: number;
  level?: HandoffLevel;
  levelTokenBudgets?: Partial<Record<HandoffLevel, number>>;
}

function estimatedTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}

function resolveBudget(options: HandoffBudgetOptions): number {
  if (options.totalMaxTokens != null) {
    return options.totalMaxTokens;
  }
  const level = options.level ?? "L3_facts_plan_delta";
  return options.levelTokenBudgets?.[level] ?? HANDOFF_LEVEL_TOKEN_BUDGET[level];
}

export function createAgentHandoff(
  input: Omit<AgentHandoff, "handoffId" | "createdAt" | "contextSummary" | "historyRefs"> & {
    contextSummary?: string;
    historyRefs?: string[];
  },
): AgentHandoff {
  return {
    ...input,
    handoffId: newId("handoff"),
    createdAt: nowIso(),
    contextSummary: input.contextSummary ?? input.state.latestSummary,
    historyRefs: [...(input.historyRefs ?? [])],
  };
}

export function compactAgentHandoff(
  handoff: AgentHandoff,
  options: HandoffBudgetOptions = {},
): AgentHandoff {
  const clone: AgentHandoff = JSON.parse(JSON.stringify(handoff)) as AgentHandoff;
  const budget = resolveBudget(options);
  let size = estimatedTokens(clone);
  if (size <= budget) {
    return clone;
  }

  clone.historyRefs = [];
  size = estimatedTokens(clone);
  if (size <= budget) {
    return clone;
  }

  clone.fact.toolCallRecords = [];
  size = estimatedTokens(clone);
  if (size <= budget) {
    return clone;
  }

  clone.planDelta.removedSteps = [];
  clone.planDelta.changedSteps = [];
  size = estimatedTokens(clone);
  if (size <= budget) {
    return clone;
  }

  clone.state = {
    ...clone.state,
    latestSummary: clone.contextSummary,
    blockers: clone.state.blockers.slice(0, 3),
  };
  size = estimatedTokens(clone);
  if (size <= budget) {
    return clone;
  }

  clone.primaryRefs = clone.primaryRefs.slice(0, 3);
  clone.fact.artifactRefs = clone.fact.artifactRefs.slice(0, 3);
  return clone;
}
