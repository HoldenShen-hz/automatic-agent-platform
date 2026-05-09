/**
 * Agent Handoff Builder — GAP-V2-05
 *
 * Builds an AgentHandoff from step execution results.
 *
 * §12 Agent Handoff Protocol — the builder extracts:
 * - Facts (L1): artifact refs and tool call records from step outputs
 * - State (L2): current phase, blockers, remaining budget, latest summary
 * - Plan Delta (L3): added/removed/changed steps
 *
 * The builder is invoked at agent boundary boundaries (e.g., agent handoff,
 * session continuation, async task continuation) to capture execution state
 * for the next agent in the chain.
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import type { ToolCallRecord } from "./tool-call-record.js";
import type {
  AgentHandoff,
  FactLayer,
  StateLayer,
  PlanDelta,
} from "./handoff-model.js";
import type { DualChannelStepOutput } from "./types/dual-channel-step-output.js";
import type { PlanStep } from "./types/plan.js";

export interface HandoffBuilderInput {
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  currentPhase: string;
  blockers: string[];
  remainingBudgetUsd: number | null;
  latestSummary: string;
  completedSteps: readonly PlanStep[];
  stepOutputs: readonly DualChannelStepOutput[];
  primaryRefs: string[];
  /** Steps that were added mid-execution (e.g., from replanning). */
  addedSteps?: string[];
  /** Steps that were skipped/removed mid-execution. */
  removedSteps?: string[];
  /** Steps whose intent changed mid-execution. */
  changedSteps?: Array<{ stepId: string; reason: string }>;
}

/**
 * Builds an AgentHandoff from step execution results.
 *
 * @example
 * const handoff = buildFromStepResults({
 *   taskId: "task_abc",
 *   fromAgentId: "agent_primary",
 *   toAgentId: "agent_secondary",
 *   currentPhase: "execution",
 *   blockers: [],
 *   remainingBudgetUsd: 0.05,
 *   latestSummary: "Completed file search, found 3 relevant...",
 *   completedSteps: plan.steps,
 *   stepOutputs: outputs,
 *   primaryRefs: ["artifact_xyz"],
 * });
 */
export function buildFromStepResults(input: HandoffBuilderInput): AgentHandoff {
  const factLayer = buildFactLayer(input.stepOutputs, input.primaryRefs);
  const stateLayer = buildStateLayer(input);
  const planDelta = buildPlanDelta(input);

  return createAgentHandoff({
    taskId: input.taskId,
    fromAgentId: input.fromAgentId,
    toAgentId: input.toAgentId,
    fact: factLayer,
    state: stateLayer,
    planDelta,
    primaryRefs: input.primaryRefs,
  });
}

/**
 * Builds the Fact Layer (L1) from step outputs.
 * Captures artifact references and tool call records as ground truth.
 */
function buildFactLayer(
  stepOutputs: readonly DualChannelStepOutput[],
  primaryRefs: string[],
): FactLayer {
  const toolCallRecords: ToolCallRecord[] = [];

  for (const output of stepOutputs) {
    // Extract artifact refs from step output
    const artifacts = output.userFacingResult.artifacts ?? [];

    // Infer tool call records from telemetry (durationMs > 0 indicates real tool use)
    if (output.systemTelemetry.durationMs > 0) {
      const firstArtifact = artifacts[0] ?? null;
      const record: ToolCallRecord = {
        callId: output.stepId,
        toolName: inferToolName(output.userFacingResult.summary),
        inputArgs: {},
        rawOutput: output.userFacingResult.summary,
        parsedOutput: null,
        success: output.systemTelemetry.validationPassed,
        errorCode: output.systemTelemetry.validationPassed ? null : "handoff.tool_call_failed",
        errorMessage: output.systemTelemetry.validationPassed ? null : output.userFacingResult.summary,
        durationMs: output.systemTelemetry.durationMs,
        tokenUsage: { input: 0, output: output.systemTelemetry.tokensUsed },
        sandboxViolation: false,
        retryAttempt: output.systemTelemetry.retryCount,
        outputRef: firstArtifact,
      };
      toolCallRecords.push(record);
    }
  }

  return {
    artifactRefs: [...primaryRefs],
    toolCallRecords,
  };
}

/**
 * Builds the State Layer (L2) from execution context.
 * Captures mutable execution context for the receiving agent.
 */
function buildStateLayer(input: Pick<HandoffBuilderInput, "currentPhase" | "blockers" | "remainingBudgetUsd" | "latestSummary">): StateLayer {
  return {
    currentPhase: input.currentPhase,
    blockers: [...input.blockers],
    remainingBudgetUsd: input.remainingBudgetUsd,
    latestSummary: input.latestSummary,
  };
}

/**
 * Builds the Plan Delta Layer (L3) from execution metadata.
 * Captures what changed in the plan since handoff was initiated.
 */
function buildPlanDelta(
  input: Pick<HandoffBuilderInput, "completedSteps" | "addedSteps" | "removedSteps" | "changedSteps">,
): PlanDelta {
  const completedStepIds = new Set(input.completedSteps.map((s) => s.stepId));

  return {
    addedSteps: input.addedSteps ?? [],
    removedSteps: input.removedSteps ?? [],
    changedSteps: input.changedSteps ?? [],
  };
}

/**
 * Creates an AgentHandoff using the ids module for ID generation.
 */
function createAgentHandoff(
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

/**
 * Infers a tool name from a step result summary string.
 * This is a best-effort heuristic since tool names aren't explicitly stored.
 */
function inferToolName(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes("search") || lower.includes("find") || lower.includes("grep")) {
    return "code_search";
  }
  if (lower.includes("read") || lower.includes("file")) {
    return "file_read";
  }
  if (lower.includes("write") || lower.includes("edit") || lower.includes("create")) {
    return "file_write";
  }
  if (lower.includes("bash") || lower.includes("shell") || lower.includes("command")) {
    return "bash";
  }
  if (lower.includes("git")) {
    return "git";
  }
  return "unknown";
}
