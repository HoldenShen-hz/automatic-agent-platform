import type { PlannedWorkflow } from "./workflow-planner.js";

// §19.5 collaboration invariant constants
const MAX_DELEGATION_DEPTH_PER_PATH = 3;
const MAX_GLOBAL_DELEGATION_DEPTH = 8;
const DEFAULT_BUDGET = 1000;
const DEFAULT_RISK_LEVEL_NUMERIC = 50;
const ROOT_ALLOWED_TOOLS = [
  "read",
  "glob",
  "grep",
  "repo_map",
  "apply_patch",
  "diagnostics",
] as const;

export type AgentTeamStage =
  | "plan"
  | "build"
  | "review"
  | "validate"
  | "repair"
  | "release";

export type AgentModelTier = "cheap" | "standard" | "strong";

export interface AgentTeamLane {
  laneId: string;
  stage: AgentTeamStage;
  ownerRoleId: string;
  agentId: string;
  modelTier: AgentModelTier;
  responsibilities: string[];
  allowedTools: string[];
  // §19.5 collaboration invariant fields (R19-21)
  depth: number;
  budgetRemaining: number;
  correlationId: string;
  parentRunId: string | null;
  domainId: string;
  riskLevel: number;
  traceId: string;
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
  parentRunId?: string | null;
  parentDepth?: number;
  parentAllowedTools?: string[];
  budget?: number;
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

function riskLevelToNumeric(riskLevel: "low" | "medium" | "high"): number {
  switch (riskLevel) {
    case "low": return 25;
    case "medium": return 50;
    case "high": return 75;
  }
}

function computeExecutionLoop(
  riskLevel: "low" | "medium" | "high",
  workflowStepsCount: number,
): AgentTeamStage[] {
  if (riskLevel === "low") {
    return ["plan", "build", "release"];
  }

  const normalizedStepCount = Math.max(1, workflowStepsCount);
  if (riskLevel === "medium") {
    const baseLoop: AgentTeamStage[] = ["plan", "build"];
    const reviewCycles = Math.min(Math.ceil(normalizedStepCount / 2), 3);
    for (let i = 0; i < reviewCycles; i++) {
      baseLoop.push("review", "validate");
      if (i === 0 && normalizedStepCount > 3) {
        baseLoop.push("repair");
      }
    }
    baseLoop.push("release");
    return baseLoop;
  }

  const highRiskLoop: AgentTeamStage[] = [
    "plan",
    "build",
    "review",
    "validate",
    "repair",
    "validate",
  ];
  const extraReviewCycles = Math.min(
    Math.max(Math.ceil((normalizedStepCount - 2) / 2), 0),
    2,
  );
  for (let i = 0; i < extraReviewCycles; i++) {
    highRiskLoop.push("review", "validate");
  }
  highRiskLoop.push("release");
  return highRiskLoop;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Check C1: permission subsetting invariant
 * Child permissions must be a subset of parent permissions
 */
function checkPermissionSubset(
  childTools: string[],
  parentTools: string[],
): boolean {
  return childTools.every((tool) => parentTools.includes(tool));
}

/**
 * Check C2: risk_mode guard invariant
 * Child risk level cannot exceed parent risk level
 */
function checkRiskNotEscalated(
  childRisk: number,
  parentRisk: number,
): boolean {
  return childRisk <= parentRisk;
}

/**
 * Check C6: budget propagation invariant
 * Child budget cannot exceed parent budget
 */
function checkBudgetNotExceeded(
  childBudget: number,
  parentBudget: number,
): boolean {
  return childBudget <= parentBudget;
}

function assertDelegationDepth(depth: number): void {
  if (depth > MAX_DELEGATION_DEPTH_PER_PATH) {
    throw new Error(
      `delegation.depth_exceeded: path depth ${depth} exceeds max ${MAX_DELEGATION_DEPTH_PER_PATH}`,
    );
  }
  if (depth > MAX_GLOBAL_DELEGATION_DEPTH) {
    throw new Error(
      `delegation.depth_exceeded: global depth ${depth} exceeds max ${MAX_GLOBAL_DELEGATION_DEPTH}`,
    );
  }
}

export class AgentTeamService {
  /**
   * Build a collaboration plan for an agent team.
   * Enforces §19.5 collaboration invariants:
   * - Delegation depth limits (max 3 per path, global 8)
   * - Permission subsetting (C1)
   * - Risk mode guard (C2)
   * - Budget propagation (C6)
   */
  public buildPlan(input: AgentTeamPlanInput): AgentTeamPlan {
    const riskLevel = input.riskLevel ?? "medium";
    const workflow = input.workflow;
    const parentRunId = input.parentRunId ?? null;
    const parentBudget = input.budget ?? DEFAULT_BUDGET;
    const riskNumeric = riskLevelToNumeric(riskLevel);
    const delegatedPlan = parentRunId != null;

    // Generate trace and correlation IDs
    const traceId = `trace:${workflow.workflow.workflowId}:${input.taskId}:${Date.now()}`;
    const correlationId = `corr:${workflow.workflow.workflowId}:${input.taskId}`;

    if (delegatedPlan && input.parentDepth == null) {
      throw new Error(
        "acp.parent_depth_required: delegated plans must include parentDepth to enforce chain limits",
      );
    }
    const laneDepth = delegatedPlan ? input.parentDepth! + 1 : 0;
    assertDelegationDepth(laneDepth);

    const parentTools = delegatedPlan
      ? unique(input.parentAllowedTools ?? [])
      : [...ROOT_ALLOWED_TOOLS];
    if (delegatedPlan && parentTools.length === 0) {
      throw new Error(
        "acp.parent_allowed_tools_required: delegated plans must include parentAllowedTools to enforce permission subsetting",
      );
    }
    if (!delegatedPlan && !checkRiskNotEscalated(riskNumeric, DEFAULT_RISK_LEVEL_NUMERIC + 25)) {
      throw new Error(`acp.risk_escalated: root plan risk ${riskNumeric} is invalid`);
    }

    // Build build lanes with collaboration invariant fields
    const buildLanes: AgentTeamLane[] = workflow.executionSteps.map((step) => {
      const stepTools = unique([
        "read",
        "glob",
        "grep",
        ...(step.compensationModel != null ? ["apply_patch"] : []),
      ]);

      // C6: Budget propagation - each lane gets proportional budget
      const laneBudget = Math.floor(parentBudget / (workflow.executionSteps.length + 1));

      return {
        laneId: `lane:${step.stepId}`,
        stage: "build" as AgentTeamStage,
        ownerRoleId: step.roleId,
        agentId: step.agentId,
        modelTier: selectModelTier("build", riskLevel),
        responsibilities: [
          `Execute workflow step ${step.stepId}`,
          `Produce output ${step.outputKey}`,
        ],
        allowedTools: stepTools,
        depth: laneDepth,
        budgetRemaining: laneBudget,
        correlationId: `${correlationId}:${step.stepId}`,
        parentRunId,
        domainId: workflow.workflow.workflowId,
        riskLevel: riskNumeric,
        traceId: `${traceId}:${step.stepId}`,
      };
    });

    // Compute budget for standard lanes (5 fixed lanes: planner, review, validator, repair, release + 1 extra buffer)
    const standardLaneBudget = Math.floor(parentBudget / (buildLanes.length + 6));

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
        allowedTools: unique(["read", "glob", "grep", "repo_map"]),
        depth: laneDepth,
        budgetRemaining: standardLaneBudget,
        correlationId,
        parentRunId,
        domainId: workflow.workflow.workflowId,
        riskLevel: riskNumeric,
        traceId,
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
        depth: laneDepth,
        budgetRemaining: standardLaneBudget,
        correlationId: `${correlationId}:review`,
        parentRunId,
        domainId: workflow.workflow.workflowId,
        riskLevel: riskNumeric,
        traceId: `${traceId}:review`,
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
        depth: laneDepth,
        budgetRemaining: standardLaneBudget,
        correlationId: `${correlationId}:validate`,
        parentRunId,
        domainId: workflow.workflow.workflowId,
        riskLevel: riskNumeric,
        traceId: `${traceId}:validate`,
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
        depth: laneDepth,
        budgetRemaining: standardLaneBudget,
        correlationId: `${correlationId}:repair`,
        parentRunId,
        domainId: workflow.workflow.workflowId,
        riskLevel: riskNumeric,
        traceId: `${traceId}:repair`,
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
        depth: laneDepth,
        budgetRemaining: standardLaneBudget,
        correlationId: `${correlationId}:release`,
        parentRunId,
        domainId: workflow.workflow.workflowId,
        riskLevel: riskNumeric,
        traceId: `${traceId}:release`,
      },
    ];

    // R19-17: C2 risk_mode guard - ensure risk level is consistent across lanes
    for (const lane of lanes) {
      assertDelegationDepth(lane.depth);
      if (!checkPermissionSubset(lane.allowedTools, parentTools)) {
        throw new Error(
          `acp.permission_not_subset: lane ${lane.laneId} tools ${JSON.stringify(lane.allowedTools)} are not a subset of parent tools ${JSON.stringify(parentTools)}`,
        );
      }
      if (!checkRiskNotEscalated(lane.riskLevel, riskNumeric)) {
        throw new Error(
          `acp.risk_escalated: lane ${lane.laneId} risk ${lane.riskLevel} exceeds parent risk ${riskNumeric}`,
        );
      }
      // C6: Budget check
      if (!checkBudgetNotExceeded(lane.budgetRemaining, parentBudget)) {
        throw new Error(
          `acp.budget_exceeded: lane ${lane.laneId} budget ${lane.budgetRemaining} exceeds parent budget ${parentBudget}`,
        );
      }
    }

    return {
      teamId: `team:${workflow.workflow.workflowId}:${input.taskId}`,
      taskId: input.taskId,
      workflowId: workflow.workflow.workflowId,
      riskLevel,
      lanes,
      // §19.5 R19-26: risk-adaptive composition
      executionLoop: computeExecutionLoop(riskLevel, workflow.executionSteps.length),
    };
  }
}
