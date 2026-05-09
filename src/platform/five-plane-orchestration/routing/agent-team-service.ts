import type { PlannedWorkflow } from "./workflow-planner.js";

/**
 * R31-12 FIX: AgentTeamStage now has explicit semantic mapping to OAPEFLIR 8 stages.
 * The mapping is:
 *   plan      -> OAPEFLIR: plan
 *   build     -> OAPEFLIR: execute
 *   review    -> OAPEFLIR: feedback
 *   validate  -> OAPEFLIR: feedback (quality gate)
 *   repair    -> OAPEFLIR: feedback (replan loop)
 *   release   -> OAPEFLIR: release
 */
export type AgentTeamStage =
  | "plan"
  | "build"
  | "review"
  | "validate"
  | "repair"
  | "release";

/**
 * R31-12 FIX: Semantic mapping from AgentTeamStage to OAPEFLIR phases.
 */
export const AGENT_TEAM_STAGE_TO_OAPEFLIR_PHASE: Record<AgentTeamStage, string> = {
  plan: "plan",
  build: "execute",
  review: "feedback",
  validate: "feedback",
  repair: "feedback",
  release: "release",
} as const;

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

function selectModelTier(
  stage: AgentTeamStage,
  riskLevel: "low" | "medium" | "high",
): AgentModelTier {
  if (stage === "review" || stage === "validate" || stage === "release") {
    return riskLevel === "low" ? "standard" : "strong";
  }
  if (stage === "plan" || stage === "repair") {
    return riskLevel === "high" ? "strong" : "standard";
  }
  return "cheap";
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

export class AgentTeamService {
  public buildPlan(input: AgentTeamPlanInput): AgentTeamPlan {
    const riskLevel = input.riskLevel ?? "medium";
    const workflow = input.workflow;
    const buildLanes: AgentTeamLane[] = workflow.executionSteps.map((step) => ({
      laneId: `lane:${step.stepId}`,
      stage: "build",
      ownerRoleId: step.roleId,
      agentId: step.agentId,
      modelTier: selectModelTier("build", riskLevel),
      responsibilities: [
        `Execute workflow step ${step.stepId}`,
        `Produce output ${step.outputKey}`,
      ],
      allowedTools: unique([
        "read",
        "glob",
        "grep",
        ...(step.compensationModel != null ? ["apply_patch"] : []),
      ]),
    }));

    const lanes: AgentTeamLane[] = [
      {
        laneId: "lane:planner",
        stage: "plan",
        ownerRoleId: "workflow_planner",
        agentId: "agent_workflow_planner",
        modelTier: selectModelTier("plan", riskLevel),
        responsibilities: [
          "Build dependency graph",
          "Freeze allowed execution scope",
        ],
        allowedTools: ["read", "glob", "grep", "repo_map"],
      },
      ...buildLanes,
      {
        laneId: "lane:review",
        stage: "review",
        ownerRoleId: "reviewer",
        agentId: "agent_reviewer",
        modelTier: selectModelTier("review", riskLevel),
        responsibilities: [
          "Review patch bundle and artifacts",
          "Reject unsafe or out-of-scope changes",
        ],
        allowedTools: ["read", "grep", "repo_map", "diagnostics"],
      },
      {
        laneId: "lane:validator",
        stage: "validate",
        ownerRoleId: "validator",
        agentId: "agent_validator",
        modelTier: selectModelTier("validate", riskLevel),
        responsibilities: [
          "Run typecheck/test/security validation",
          "Produce validation decision",
        ],
        allowedTools: ["diagnostics", "read"],
      },
      {
        laneId: "lane:repair",
        stage: "repair",
        ownerRoleId: "repairer",
        agentId: "agent_repairer",
        modelTier: selectModelTier("repair", riskLevel),
        responsibilities: [
          "Repair only within allowed fix scope",
          "Consume structured failure evidence package",
        ],
        allowedTools: ["read", "apply_patch", "diagnostics"],
      },
      {
        laneId: "lane:release",
        stage: "release",
        ownerRoleId: "release_guard",
        agentId: "agent_release_guard",
        modelTier: selectModelTier("release", riskLevel),
        responsibilities: [
          "Approve release or escalate to human review",
        ],
        allowedTools: ["read"],
      },
    ];

    // R9-13 fix: Compute adaptive execution loop based on risk level
    // Low-risk changes go through minimal stages, high-risk go through full pipeline
    const executionLoop = computeAdaptiveExecutionLoop(riskLevel);

    return {
      teamId: `team:${workflow.workflow.workflowId}:${input.taskId}`,
      taskId: input.taskId,
      workflowId: workflow.workflow.workflowId,
      riskLevel,
      lanes,
      executionLoop,
    };
  }
}

/**
 * R9-13 fix: Computes adaptive execution loop based on risk level.
 * Low-risk changes use minimal stages, high-risk use full validation pipeline.
 */
function computeAdaptiveExecutionLoop(riskLevel: "low" | "medium" | "high"): AgentTeamStage[] {
  switch (riskLevel) {
    case "low":
      // Minimal loop for low-risk: skip review/repair stages
      return ["plan", "build", "release"];
    case "medium":
      // Standard loop with validation but no repair loop
      return ["plan", "build", "review", "validate", "release"];
    case "high":
      // Full loop with repair cycle for high-risk changes
      return ["plan", "build", "review", "validate", "repair", "validate", "release"];
  }
}
