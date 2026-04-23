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
import type { AgentHandoff } from "./handoff-model.js";
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
    changedSteps?: Array<{
        stepId: string;
        reason: string;
    }>;
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
export declare function buildFromStepResults(input: HandoffBuilderInput): AgentHandoff;
