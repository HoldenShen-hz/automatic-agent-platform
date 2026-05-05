import type { PlannedWorkflow } from "./workflow-planner.js";

// §19.5 collaboration invariant constants
const MAX_DELEGATION_DEPTH_PER_PATH = 3;
const MAX_GLOBAL_DELEGATION_DEPTH = 8;
const DEFAULT_BUDGET = 1000;
const DEFAULT_RISK_LEVEL_NUMERIC = 50;

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
  // §19.5 R19-26: risk-adaptive composition for high-risk tasks
  // Low-risk: minimal pipeline
  if (riskLevel === "low") {
    return ["plan", "build", "release"];
  }
  // Medium-risk: full review loop (same adaptive logic as high-risk)
  // R9-13 fix: medium risk also uses adaptive stage count based on workflow step count
  const baseLoop: AgentTeamStage[] = ["plan", "build"];
  // Add review-validate cycles based on step count (more steps = more checks)
  const reviewCycles = Math.min(Math.ceil(workflowStepsCount / 2), 3);
  for (let i = 0; i < reviewCycles; i++) {
    baseLoop.push("review", "validate");
    // Only add repair after first review cycle if steps > threshold
    if (i === 0 && workflowStepsCount > 3) {
      baseLoop.push("repair");
    }
  }
  baseLoop.push("release");
  return baseLoop;
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

    // Generate trace and correlation IDs
    const traceId = `trace:${workflow.workflow.workflowId}:${input.taskId}:${Date.now()}`;
    const correlationId = `corr:${workflow.workflow.workflowId}:${input.taskId}`;

    // §19.5: depth starts at 0 for root plan, parent depth + 1 for delegated
    const rootDepth = 0;
    const effectiveGlobalDepth = rootDepth + 1;

    // R19-17: Validate delegation depth limits (use >= since depth of exactly MAX should be rejected)
    if (effectiveGlobalDepth >= MAX_GLOBAL_DELEGATION_DEPTH) {
      throw new Error(
        `delegation.depth_exceeded: global depth ${effectiveGlobalDepth} exceeds max ${MAX_GLOBAL_DELEGATION_DEPTH}`,
      );
    }

    // Compute parent permissions (tools) for C1 subsetting check
    // Root plan has full permissions; delegated plans inherit subset
    const parentTools = parentRunId
      ? ["read", "glob", "grep"] // Delegated agents get restricted tools
      : ["read", "glob", "grep", "repo_map", "apply_patch", "diagnostics"]; // Root has more

    // Build build lanes with collaboration invariant fields
    const buildLanes: AgentTeamLane[] = workflow.executionSteps.map((step, idx) => {
      const stepTools = unique([
        "read",
        "glob",
        "grep",
        ...(step.compensationModel != null ? ["apply_patch"] : []),
      ]);

      // C1: Check permission subsetting - build lane tools must be subset of parent tools
      if (!checkPermissionSubset(stepTools, parentTools)) {
        throw new Error(
          `acp.permission_not_subset: lane ${step.stepId} tools ${JSON.stringify(stepTools)} are not a subset of parent tools ${JSON.stringify(parentTools)}`,
        );
      }

      // C6: Budget propagation - each lane gets proportional budget
      const laneBudget = Math.floor(parentBudget / (workflow.executionSteps.length + 1));

      // R19-17: Per-path depth check (max 3 per path, >= since exactly 3 is not allowed)
      const pathDepth = rootDepth + idx + 1;
      if (pathDepth >= MAX_DELEGATION_DEPTH_PER_PATH) {
        throw new Error(
          `delegation.depth_exceeded: path depth ${pathDepth} exceeds max ${MAX_DELEGATION_DEPTH_PER_PATH}`,
        );
      }

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
        depth: pathDepth,
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
        allowedTools: parentRunId ? ["read", "glob", "grep"] : ["read", "glob", "grep", "repo_map"],
        depth: rootDepth,
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
        depth: rootDepth + 1,
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
        depth: rootDepth + 1,
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
        depth: rootDepth + 1,
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
        depth: rootDepth + 1,
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
