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

export interface AgentHandoff {
  handoffId: string;
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  createdAt: string;
  fact: FactLayer;
  state: StateLayer;
  planDelta: PlanDelta;
  primaryRefs: string[];
}

export interface HandoffBudgetOptions {
  totalMaxTokens: number;
}

function estimatedTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}

export function createAgentHandoff(input: Omit<AgentHandoff, "handoffId" | "createdAt">): AgentHandoff {
  return {
    ...input,
    handoffId: newId("handoff"),
    createdAt: nowIso(),
  };
}

export function compactAgentHandoff(
  handoff: AgentHandoff,
  options: HandoffBudgetOptions,
): AgentHandoff {
  const clone: AgentHandoff = JSON.parse(JSON.stringify(handoff)) as AgentHandoff;
  let size = estimatedTokens(clone);
  if (size <= options.totalMaxTokens) {
    return clone;
  }

  clone.fact.toolCallRecords = [];
  size = estimatedTokens(clone);
  if (size <= options.totalMaxTokens) {
    return clone;
  }

  clone.planDelta.removedSteps = [];
  clone.planDelta.changedSteps = [];
  size = estimatedTokens(clone);
  if (size <= options.totalMaxTokens) {
    return clone;
  }

  clone.state = {
    ...clone.state,
    latestSummary: "",
    blockers: clone.state.blockers.slice(0, 3),
  };
  size = estimatedTokens(clone);
  if (size <= options.totalMaxTokens) {
    return clone;
  }

  clone.primaryRefs = clone.primaryRefs.slice(0, 3);
  clone.fact.artifactRefs = clone.fact.artifactRefs.slice(0, 3);
  return clone;
}
