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
    changedSteps: Array<{
        stepId: string;
        reason: string;
    }>;
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
export declare function createAgentHandoff(input: Omit<AgentHandoff, "handoffId" | "createdAt">): AgentHandoff;
export declare function compactAgentHandoff(handoff: AgentHandoff, options: HandoffBudgetOptions): AgentHandoff;
