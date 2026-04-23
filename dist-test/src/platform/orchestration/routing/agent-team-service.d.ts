import type { PlannedWorkflow } from "./workflow-planner.js";
export type AgentTeamStage = "plan" | "build" | "review" | "validate" | "repair" | "release";
export type AgentModelTier = "cheap" | "standard" | "strong";
export interface AgentTeamLane {
    laneId: string;
    stage: AgentTeamStage;
    ownerRoleId: string;
    agentId: string;
    modelTier: AgentModelTier;
    responsibilities: string[];
    allowedTools: string[];
}
export interface AgentTeamPlan {
    teamId: string;
    taskId: string;
    workflowId: string;
    riskLevel: "low" | "medium" | "high";
    lanes: AgentTeamLane[];
    executionLoop: AgentTeamStage[];
}
export interface AgentTeamPlanInput {
    taskId: string;
    workflow: PlannedWorkflow;
    riskLevel?: "low" | "medium" | "high";
}
export declare class AgentTeamService {
    buildPlan(input: AgentTeamPlanInput): AgentTeamPlan;
}
