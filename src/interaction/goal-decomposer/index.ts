import { createHash } from "node:crypto";

import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import type { BudgetLedger, BudgetResourceKind } from "../../platform/contracts/executable-contracts/index.js";
import {
  BudgetGuard,
  type BudgetPolicy,
} from "../../platform/model-gateway/cost-tracker/index.js";
import type { RiskPreview } from "../nl-gateway/index.js";
import { matchDomainRecipe, type DomainRecipe } from "../../domains/recipes/index.js";
import type { LlmPlanGenerator } from "./llm-plan-generator.js";
export * from "./llm-plan-generator.js";

export interface SuccessCriterion {
  readonly metric: string;
  readonly target: string;
  readonly evaluationMethod: "metric_api" | "human_review" | "automated_test";
}

export interface Goal {
  readonly goalId: string;
  readonly description: string;
  readonly owner: string;
  readonly deadline?: string;
  readonly successCriteria: readonly SuccessCriterion[];
  readonly constraints: readonly string[];
  readonly priority: "low" | "normal" | "high" | "critical";
}

export interface PlannedTask {
  readonly taskId: string;
  readonly domainId: string;
  readonly description: string;
  readonly inputs: Record<string, unknown>;
  readonly expectedOutputs: readonly string[];
  readonly delegationMode: "auto" | "supervised" | "manual";
  readonly estimatedDuration: string;
  readonly estimatedCost: CostEstimate;
  readonly constraintEnvelope?: GoalConstraintEnvelope;
  /** @deprecated Use dependencyGraph instead - explicit depends_on for DAG scheduling */
  readonly dependsOn?: readonly string[];
}

export interface TaskDependency {
  readonly fromTask: string;
  readonly toTask: string;
  readonly type: "blocks" | "provides_input" | "soft_dependency";
  readonly dataContract?: string;
}

export interface GoalDecomposition {
  readonly goalId: string;
  readonly tasks: readonly PlannedTask[];
  readonly dependencyGraph: readonly TaskDependency[];
  readonly estimatedDuration: string;
  readonly estimatedCost: CostEstimate;
  readonly riskSummary: RiskPreview;
  readonly decompositionConfidence: number;
  readonly requiresHumanReview: boolean;
  readonly decompositionStrategy?: "template" | "llm_plan" | "hybrid" | "human_assisted";
  readonly topologicallySortedTaskIds?: readonly string[];
  readonly parallelTaskGroups?: readonly (readonly string[])[];
  readonly criticalPathTaskIds?: readonly string[];
  /** Actual depth used in decomposition (may be less than maxDepth if goal is simple) */
  readonly depthUsed: number;
  /** Whether maxDepth was reached during decomposition */
  readonly maxDepthReached: boolean;
  readonly lifecycleState: GoalLifecycleState;
  readonly goalGraphDraft: GoalGraphDraft;
  readonly taskGraphDraft: TaskGraphDraft;
  readonly plannerHandoff: PlannerHandoffReceipt;
}

export type GoalLifecycleState =
  | "draft"
  | "decomposing"
  | "decomposed"
  | "partially_completed"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export interface GoalConstraintEnvelope {
  readonly budgetLimitUsd: number | null;
  readonly riskTolerance: "low" | "medium" | "high";
  readonly requiresApproval: boolean;
  readonly requiredPermissions: readonly string[];
  readonly requiredCapabilities: readonly string[];
}

export interface GoalGraphDraft {
  readonly goalId: string;
  readonly lifecycleState: GoalLifecycleState;
  readonly constraintEnvelope: GoalConstraintEnvelope;
  readonly plannerIntent: "template" | "llm_plan" | "hybrid" | "human_assisted";
  readonly evidenceRefs: readonly string[];
}

export interface TaskGraphDraft {
  readonly graphId: string;
  readonly goalId: string;
  readonly tasks: readonly PlannedTask[];
  readonly dependencyGraph: readonly TaskDependency[];
  readonly normalized: boolean;
  readonly validationMessages: readonly string[];
  readonly worstPathTaskIds: readonly string[];
}

export interface PlannerHandoffReceipt {
  readonly handoffId: string;
  readonly goalId: string;
  readonly state: "ready_for_planner" | "blocked_invalid_graph";
  readonly graphId: string;
  readonly constraintEnvelope: GoalConstraintEnvelope;
  readonly budgetLedgerId?: string;
  readonly budgetReservationId?: string;
  readonly reservedBudgetUsd?: number | null;
}

export type GoalDecompositionResult = GoalDecomposition;

export interface GoalDecompositionPort {
  decompose(goal: Goal | string): Promise<GoalDecomposition>;
}

export interface GoalDecompositionServiceOptions {
  readonly costEstimator?: { estimate(divisionId?: string | null): CostEstimate } | null;
  readonly llmPlanGenerator?: LlmPlanGenerator | null;
  readonly maxLlmPlanLatencyMs?: number;
  /** Maximum decomposition depth to prevent infinite recursion (default: 5) */
  readonly maxDepth?: number;
  /** Current decomposition depth (used internally, do not set manually) */
  readonly currentDepth?: number;
  readonly budgetControl?: {
    readonly policy: BudgetPolicy;
    readonly currentTaskCostUsd?: number;
    readonly currentDailyCostUsd?: number;
    readonly currentMonthlyCostUsd?: number;
    readonly tenantId: string;
    readonly harnessRunId: string;
    readonly traceId: string;
    readonly emittedBy: string;
    readonly ledger?: BudgetLedger;
    readonly estimatedLlmPlanCostUsd?: number;
    readonly resourceKind?: BudgetResourceKind;
    readonly expiresAt?: string;
  };
  // R5-28: Domain capabilities for validation
  readonly domainCapabilities?: Readonly<Record<string, readonly string[]>>;
  readonly domainRecipes?: readonly DomainRecipe[];
  // R9-46: Domain recipe service for template detection
  readonly domainRecipeService?: {
    matchRecipe(domainId: string, input: string): { archetype?: string; triggerPhrases?: readonly string[] } | null;
  } | null;
  readonly planGraphHarnessRuntime?: unknown;
}

/**
 * R5-28: Domain capability validation result
 */
export interface CapabilityValidationResult {
  readonly valid: boolean;
  readonly missingCapabilities: readonly string[];
  readonly unauthorizedPermissions: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly validationMessages: readonly string[];
}

const DEFAULT_COST_ESTIMATE: CostEstimate = {
  estimatedCostUsd: 0.05,
  confidence: "default",
  sampleCount: 0,
  divisionId: null,
  basedOn: "default",
};

/** Default maximum decomposition depth to prevent infinite recursion */
const DEFAULT_MAX_DEPTH = 5;
/** R5-18: Maximum delegation chain depth - tasks can only be delegated this many times */
const DEFAULT_MAX_DELEGATION_DEPTH = 3;
/** R5-18: Global call depth cap - total call stack depth limit */
const DEFAULT_GLOBAL_CALL_DEPTH_CAP = 8;
const DEFAULT_LLM_PLAN_LATENCY_MS = 10_000;
const DEFAULT_DOMAIN_CAPABILITIES: Readonly<Record<string, readonly string[]>> = {
  advertising: [],
  communications: [],
  content_production: [],
  data_analysis: ["analytics"],
  engineering_ops: [],
  finance: ["approval_workflow"],
  general_ops: ["analytics", "approval_workflow"],
  hr: [],
  legal: ["approval_workflow"],
  operations: ["approval_workflow"],
  quality_assurance: [],
  security: [],
};
const DEFAULT_DOMAIN_PERMISSIONS: Readonly<Record<string, readonly string[]>> = {
  advertising: [],
  communications: [],
  content_production: [],
  data_analysis: [],
  engineering_ops: ["deployment:write"],
  finance: [],
  general_ops: [],
  hr: [],
  legal: [],
  operations: ["deployment:write"],
  quality_assurance: [],
  security: [],
};
const HIGH_RISK_KEYWORDS = [
  "deploy",
  "release",
  "publish",
  "price",
  "budget",
  "approval",
  "production",
  "prod",
  "上线",
  "发布",
  "审批",
  "投放",
  "预算",
  "价格",
  "生产环境",
  "线上",
] as const;
const CRITICAL_RISK_KEYWORDS = [
  "delete production",
  "drop table",
  "mass delete",
  "delete all",
  "删除全部",
  "删除生产",
  "清空",
  "生产数据",
] as const;

function normalizeGoal(goal: Goal | string): Goal {
  if (typeof goal !== "string") {
    return goal;
  }
  const goalHash = createHash("sha256").update(goal).digest("hex").slice(0, 16);
  return {
    goalId: `goal:${goalHash}`,
    description: goal,
    owner: "unknown",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };
}

function buildRiskSummary(goal: Goal, matchedTemplate: string | null): RiskPreview {
  const normalized = goal.description.toLowerCase();
  const critical = goal.priority === "critical" || CRITICAL_RISK_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const high = critical || HIGH_RISK_KEYWORDS.some((keyword) => normalized.includes(keyword));

  return {
    overallRisk: critical ? "critical" : high ? "high" : matchedTemplate == null ? "medium" : "low",
    riskFactors: [
      ...(critical ? ["目标优先级为 critical"] : []),
      ...(high ? ["目标可能涉及跨域协作或线上影响"] : []),
      ...(matchedTemplate == null ? ["缺少命中的成熟模板，分解结果需要人工复核"] : []),
    ],
    reversible: !/(delete|drop|remove|删除|清空)/i.test(normalized),
    sideEffects: [
      ...(matchedTemplate === "marketing_campaign" ? ["会触发多域协作、素材和投放成本"] : []),
      ...(matchedTemplate === "release_launch" ? ["可能影响线上发布节奏和环境稳定性"] : []),
    ],
    approvalNeeded: critical || high,
  };
}

function parseConstraintEnvelope(goal: Goal): GoalConstraintEnvelope {
  const rawConstraints = [goal.description, ...goal.constraints].join(" ");
  const budgetMatch = /(?:budget|预算|费用)\D*(\d+(?:\.\d+)?)/i.exec(rawConstraints);
  const requiredPermissions = [
    ...( /(deploy|release|publish|上线|发布)/i.test(rawConstraints) ? ["deployment:write"] : []),
    ...( /(delete|drop|remove|删除|清空)/i.test(rawConstraints) ? ["destructive:write"] : []),
  ];
  const requiredCapabilities = [
    ...( /(dashboard|report|报表|roi|分析)/i.test(rawConstraints) ? ["analytics"] : []),
    ...( /(approval|审批)/i.test(rawConstraints) ? ["approval_workflow"] : []),
  ];
  return {
    budgetLimitUsd: budgetMatch == null ? null : Number.parseFloat(budgetMatch[1]!),
    riskTolerance: goal.priority === "critical" ? "low" : goal.priority === "high" ? "medium" : "high",
    requiresApproval: /(approval|审批|deploy|release|publish|delete|删除)/i.test(rawConstraints),
    requiredPermissions,
    requiredCapabilities,
  };
}

function totalCost(costs: readonly CostEstimate[]): CostEstimate {
  if (costs.length === 0) {
    return DEFAULT_COST_ESTIMATE;
  }
  const confidenceOrder = ["default", "low", "medium", "high"] as const;
  return {
    estimatedCostUsd: Number(costs.reduce((sum, item) => sum + item.estimatedCostUsd, 0).toFixed(4)),
    confidence: costs
      .map((item) => item.confidence)
      .sort((left, right) => confidenceOrder.indexOf(left) - confidenceOrder.indexOf(right))[0] ?? "default",
    sampleCount: costs.reduce((sum, item) => sum + item.sampleCount, 0),
    divisionId: null,
    basedOn: costs.every((item) => item.basedOn === "division_avg") ? "division_avg" : costs.some((item) => item.basedOn === "global_avg") ? "global_avg" : "default",
  };
}

function parseDurationHours(raw: string): number {
  const match = /^(\d+)(h|d)$/.exec(raw.trim());
  if (!match) {
    return 0;
  }
  const value = Number(match[1]);
  return match[2] === "d" ? value * 24 : value;
}

function aggregateEstimatedDuration(tasks: readonly PlannedTask[]): string {
  const totalHours = tasks.reduce((sum, task) => sum + parseDurationHours(task.estimatedDuration), 0);
  if (totalHours <= 0) {
    return `${Math.max(1, tasks.length)}d`;
  }
  if (totalHours % 24 === 0) {
    return `${totalHours / 24}d`;
  }
  return `${totalHours}h`;
}

export class GoalDecompositionService implements GoalDecompositionPort {
  /** R5-18: Anti-multiplication guard - tracks decomposed goal IDs to prevent duplicate work */
  private readonly decomposedGoalIds = new Set<string>();
  /** R5-18: Tracks delegation depth per goal chain */
  private readonly delegationDepth = new Map<string, number>();

  public constructor(private readonly options: GoalDecompositionServiceOptions = {}) {}

  public async decompose(goalInput: Goal | string): Promise<GoalDecomposition> {
    const maxDepth = this.options.maxDepth ?? DEFAULT_MAX_DEPTH;
    const currentDepth = this.options.currentDepth ?? 0;

    const goal = normalizeGoal(goalInput);

    // R5-18: Anti-multiplication guard - prevent same goal from being decomposed multiple times
    if (this.decomposedGoalIds.has(goal.goalId)) {
      throw new Error(`goal_decomposer.duplicate_decomposition:${goal.goalId}`);
    }
    this.decomposedGoalIds.add(goal.goalId);

    // R5-18: Delegation chain depth limit (max=3)
    const maxDelegationDepth = DEFAULT_MAX_DELEGATION_DEPTH;
    const currentDelegationDepth = this.delegationDepth.get(goal.goalId) ?? 0;
    if (currentDelegationDepth >= maxDelegationDepth) {
      throw new Error(`goal_decomposer.delegation_depth_exceeded:${goal.goalId}:${currentDelegationDepth}`);
    }
    this.delegationDepth.set(goal.goalId, currentDelegationDepth + 1);

    // R5-18: Global call depth cap (=8)
    const globalCallDepth = (this.options as { _globalCallDepth?: number })._globalCallDepth ?? 0;
    if (globalCallDepth >= DEFAULT_GLOBAL_CALL_DEPTH_CAP) {
      throw new Error(`goal_decomposer.global_call_depth_exceeded:${globalCallDepth}`);
    }

    const constraintEnvelope = parseConstraintEnvelope(goal);
    const matchedTemplate = this.detectTemplate(goal.description);
    // R5-19: Calculate risk early for propagation to subtasks
    const riskSummary = buildRiskSummary(goal, matchedTemplate);
    // R5-19: Pass proportional budget and risk for propagation
    let tasks = this.buildTasks(goal, matchedTemplate, constraintEnvelope.budgetLimitUsd ?? undefined, riskSummary.overallRisk);
    let dependencyGraph = this.buildDependencies(tasks, matchedTemplate);

    // R5-28: Validate domain capabilities before returning decomposition
    const capabilityValidation = this.validateCapabilities(tasks, constraintEnvelope);

    let decompositionStrategy: GoalDecomposition["decompositionStrategy"] =
      matchedTemplate == null
        ? "human_assisted"
        : matchedTemplate === "generic_multi_step"
          ? "hybrid"
          : "template";
    let budgetBlockedLlmPlan = false;

    if ((matchedTemplate == null || matchedTemplate === "generic_multi_step")
      && goal.description.trim().length > 50
      && this.options.llmPlanGenerator != null) {
      try {
        if (this.options.budgetControl != null) {
          const guard = new BudgetGuard();
          const evaluated = guard.evaluateExecutionChain({
            policy: this.options.budgetControl.policy,
            spend: {
              currentTaskCostUsd: this.options.budgetControl.currentTaskCostUsd ?? 0,
              currentDailyCostUsd: this.options.budgetControl.currentDailyCostUsd ?? 0,
              currentMonthlyCostUsd: this.options.budgetControl.currentMonthlyCostUsd ?? 0,
              nextEstimatedCostUsd: this.options.budgetControl.estimatedLlmPlanCostUsd ?? 0.25,
            },
          });
          budgetBlockedLlmPlan = !evaluated.allowed;
        }
        if (budgetBlockedLlmPlan) {
          throw new Error("goal_decomposer.budget_reservation_required");
        }
        const llmPlan = await this.withTimeout(
          this.options.llmPlanGenerator.generate(goal),
          this.options.maxLlmPlanLatencyMs ?? DEFAULT_LLM_PLAN_LATENCY_MS,
        );
        if (llmPlan.tasks.length > 0) {
          tasks = llmPlan.tasks.map((task) => ({
            ...task,
            constraintEnvelope,
          }));
          dependencyGraph = [...llmPlan.dependencyGraph];
          decompositionStrategy = "llm_plan";
        }
      } catch {
        decompositionStrategy = "hybrid";
      }
    }
    const graphAnalysis = this.analyzeDependencyGraph(tasks, dependencyGraph);
    const depthUsed = Math.max(currentDepth, graphAnalysis.maxDependencyDepth);
    const maxDepthReached = depthUsed >= maxDepth;
    const estimatedCost = totalCost(tasks.map((task) => task.estimatedCost));
    // riskSummary already calculated above for propagation
    const decompositionConfidence =
      decompositionStrategy === "llm_plan"
        ? 0.83
        : matchedTemplate == null
          ? 0.62
          : matchedTemplate === "generic_multi_step"
            ? 0.74
            : 0.88;

    const validationMessages = [
      ...(graphAnalysis.hasCycle ? ["goal_decomposer.cycle_detected"] : []),
      ...(maxDepthReached ? [`goal_decomposer.max_depth_reached:${depthUsed}:${maxDepth}`] : []),
      ...(constraintEnvelope.requiresApproval ? ["goal_decomposer.approval_constraint_propagated"] : []),
      ...(budgetBlockedLlmPlan ? ["goal_decomposer.llm_budget_reservation_blocked"] : []),
      ...capabilityValidation.validationMessages,
    ];
    const lifecycleState: GoalLifecycleState = "decomposed";
    const goalGraphDraft: GoalGraphDraft = {
      goalId: goal.goalId,
      lifecycleState,
      constraintEnvelope,
      plannerIntent: decompositionStrategy,
      evidenceRefs: [`goal:${goal.goalId}`, `template:${matchedTemplate ?? "none"}`],
    };
    const taskGraphDraft: TaskGraphDraft = {
      graphId: `${goal.goalId}:task_graph_draft`,
      goalId: goal.goalId,
      tasks,
      dependencyGraph,
      normalized: !graphAnalysis.hasCycle,
      validationMessages,
      worstPathTaskIds: graphAnalysis.criticalPathTaskIds,
    };
    const plannerHandoff: PlannerHandoffReceipt = {
      handoffId: `${goal.goalId}:planner_handoff`,
      goalId: goal.goalId,
      state: graphAnalysis.hasCycle ? "blocked_invalid_graph" : "ready_for_planner",
      graphId: taskGraphDraft.graphId,
      constraintEnvelope,
    };

    // R23-04 fix: §40.2 requires rejecting with error when cycle is detected, not just warning
    if (graphAnalysis.hasCycle) {
      throw new Error(`goal_decomposer.cycle_detected:${goal.goalId}`);
    }

    return {
      goalId: goal.goalId,
      tasks,
      dependencyGraph,
      estimatedDuration: aggregateEstimatedDuration(tasks),
      estimatedCost,
      riskSummary,
      decompositionConfidence,
      requiresHumanReview:
        decompositionConfidence < 0.7
        || riskSummary.overallRisk === "critical"
        || goal.priority === "critical"
        || graphAnalysis.hasCycle
        || maxDepthReached
        || !capabilityValidation.valid,
      decompositionStrategy,
      topologicallySortedTaskIds: graphAnalysis.topologicallySortedTaskIds,
      parallelTaskGroups: graphAnalysis.parallelTaskGroups,
      criticalPathTaskIds: graphAnalysis.criticalPathTaskIds,
      depthUsed,
      maxDepthReached,
      lifecycleState,
      goalGraphDraft,
      taskGraphDraft,
      plannerHandoff,
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error("goal_decomposer.llm_plan_timeout")), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private detectTemplate(description: string): "marketing_campaign" | "release_launch" | "incident_response" | "hiring_pipeline" | "generic_multi_step" | null {
    const matchedRecipe = this.options.domainRecipes == null
      ? null
      : matchDomainRecipe(this.options.domainRecipes, description);
    if (matchedRecipe != null) {
      const recipeMapped = this.mapArchetypeToTemplate(matchedRecipe.archetype);
      if (recipeMapped != null) {
        return recipeMapped;
      }
    }

    // R9-46: First try DomainRecipe integration if service is configured
    const recipeService = this.options.domainRecipeService;
    if (recipeService != null) {
      // Try to match against registered domain recipes
      // Use "general_ops" as default domain since we're doing broad template detection
      const matched = recipeService.matchRecipe("general_ops", description);
      if (matched?.archetype != null) {
        const serviceMapped = this.mapArchetypeToTemplate(matched.archetype);
        if (serviceMapped != null) {
          return serviceMapped;
        }
      }
      // If recipe matched but archetype doesn't map, fall through to regex patterns
    }

    // R9-46: Fall back to regex pattern matching (was previously hardcoded 5 patterns)
    if (/(campaign|marketing|广告|投放|素材|营销|推广)/i.test(description)) {
      return "marketing_campaign";
    }
    if (/(launch|release|deploy|上线|发布)/i.test(description)) {
      return "release_launch";
    }
    if (/(incident|outage|故障|恢复|排查)/i.test(description)) {
      return "incident_response";
    }
    if (/(hire|recruit|onboard|招聘|候选人|入职)/i.test(description)) {
      return "hiring_pipeline";
    }
    if (description.trim().length > 20) {
      return "generic_multi_step";
    }
    return null;
  }

  private mapArchetypeToTemplate(
    archetype: string,
  ): "marketing_campaign" | "release_launch" | "incident_response" | "hiring_pipeline" | null {
    const archetypeLower = archetype.toLowerCase();
    if (archetypeLower.includes("marketing") || archetypeLower.includes("campaign") || archetypeLower.includes("creative")) {
      return "marketing_campaign";
    }
    if (archetypeLower.includes("release") || archetypeLower.includes("deploy") || archetypeLower.includes("launch") || archetypeLower.includes("realtime")) {
      return "release_launch";
    }
    if (archetypeLower.includes("incident") || archetypeLower.includes("operations") || archetypeLower.includes("triage")) {
      return "incident_response";
    }
    if (archetypeLower.includes("hire") || archetypeLower.includes("recruit") || archetypeLower.includes("hr")) {
      return "hiring_pipeline";
    }
    return null;
  }

  private buildTasks(goal: Goal, template: ReturnType<GoalDecompositionService["detectTemplate"]>, proportionalBudget?: number, parentRisk?: "low" | "medium" | "high" | "critical"): PlannedTask[] {
    // R5-19: Build initial tasks to calculate base costs for proportional allocation
    const initialTasks = this.buildTasksInternal(goal, template);
    const baseCosts = initialTasks.map((t) => t.estimatedCost.estimatedCostUsd);
    const totalBaseCost = baseCosts.reduce((sum, cost) => sum + cost, 0);

    // R5-19: Proportional budget allocation - distribute parent budget proportionally based on estimated costs
    const budgetPerTask = totalBaseCost > 0 && proportionalBudget != null
      ? proportionalBudget / initialTasks.length
      : null;

    // R5-19: Risk propagation - subtask inherits parent risk, but critical/high can only be reduced one level at a time
    const propagatedRisk = parentRisk
      ? this.propagateRisk(parentRisk)
      : undefined;

    return initialTasks.map((task) => {
      const domainPermissions = DEFAULT_DOMAIN_PERMISSIONS[task.domainId] ?? [];
      const updatedConstraintEnvelope = task.constraintEnvelope
        ? {
            ...task.constraintEnvelope,
            ...(budgetPerTask != null ? { budgetLimitUsd: budgetPerTask } : {}),
            // R5-19/R9-42: Propagate risk to subtasks (critical/high can only reduce one level at a time)
            ...(propagatedRisk != null ? { riskTolerance: propagatedRisk } : {}),
            requiredPermissions: (task.constraintEnvelope.requiredPermissions ?? []).filter((permission) =>
              domainPermissions.includes(permission),
            ),
          }
        : undefined;
      return {
        ...task,
        ...(updatedConstraintEnvelope ? { constraintEnvelope: updatedConstraintEnvelope } : {}),
      };
    });
  }

  /**
   * R5-19: Internal method to build tasks without budget/risk modification
   */
  private buildTasksInternal(goal: Goal, template: ReturnType<GoalDecompositionService["detectTemplate"]>): PlannedTask[] {
    switch (template) {
      case "marketing_campaign":
        return [
          this.makeTask("content_production", "制作广告素材与内容骨架", goal, "6h"),
          this.makeTask("legal", "审核创意和文案的合规性", goal, "4h"),
          this.makeTask("advertising", "创建并配置广告计划", goal, "5h"),
          this.makeTask("data_analysis", "建立 ROI 与效果追踪看板", goal, "4h"),
        ];
      case "release_launch":
        return [
          this.makeTask("engineering_ops", "完成发布实现与变更确认", goal, "6h"),
          this.makeTask("quality_assurance", "执行发布前验证和回归检查", goal, "4h"),
          this.makeTask("operations", "准备部署、回滚和运行值守", goal, "4h"),
          this.makeTask("data_analysis", "跟踪发布后关键指标", goal, "3h"),
        ];
      case "incident_response":
        return [
          this.makeTask("operations", "收集症状、构建故障上下文", goal, "2h"),
          this.makeTask("engineering_ops", "执行定位、修复和恢复动作", goal, "4h"),
          this.makeTask("security", "检查是否涉及安全或合规风险", goal, "2h"),
          this.makeTask("communications", "产出事件摘要与后续建议", goal, "2h"),
        ];
      case "hiring_pipeline":
        return [
          this.makeTask("hr", "定义招聘需求与候选人筛选条件", goal, "4h"),
          this.makeTask("legal", "核对用工与合规要求", goal, "2h"),
          this.makeTask("finance", "确认预算与审批路径", goal, "2h"),
          this.makeTask("operations", "安排 onboarding 和跟进事项", goal, "3h"),
        ];
      default:
        return [
          this.makeTask("general_ops", "分析目标、约束和成功标准", goal, "2h"),
          this.makeTask("general_ops", "执行主体任务并产出主要结果", goal, "4h"),
          this.makeTask("general_ops", "整理结果、验证并形成交付摘要", goal, "2h"),
        ];
    }
  }

  private buildDependencies(tasks: readonly PlannedTask[], template: ReturnType<GoalDecompositionService["detectTemplate"]>): TaskDependency[] {
    const dependencies: TaskDependency[] = [];

    // Build template-based dependencies
    if (tasks.length >= 2) {
      if (template === "marketing_campaign") {
        dependencies.push(
          { fromTask: tasks[0]!.taskId, toTask: tasks[1]!.taskId, type: "blocks", dataContract: "creative_review" },
          { fromTask: tasks[1]!.taskId, toTask: tasks[2]!.taskId, type: "blocks", dataContract: "approved_creatives" },
          { fromTask: tasks[2]!.taskId, toTask: tasks[3]!.taskId, type: "provides_input", dataContract: "campaign_tracking" },
        );
      } else {
        // Default sequential dependencies
        for (let i = 1; i < tasks.length; i++) {
          dependencies.push({
            fromTask: tasks[i - 1]!.taskId,
            toTask: tasks[i]!.taskId,
            type: i === tasks.length - 1 ? "provides_input" : "blocks",
          });
        }
      }
    }

    // Convert dependsOn to edges (supports DAG parallel execution)
    const taskIdSet = new Set(tasks.map((t) => t.taskId));
    for (const task of tasks) {
      if (task.dependsOn && task.dependsOn.length > 0) {
        for (const depId of task.dependsOn) {
          if (taskIdSet.has(depId)) {
            // Avoid duplicate edges
            if (!dependencies.some((d) => d.fromTask === depId && d.toTask === task.taskId)) {
              dependencies.push({
                fromTask: depId,
                toTask: task.taskId,
                type: "blocks",
              });
            }
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * R5-19: Risk propagation - risk is propagated down the delegation chain
   * Each subtask inherits parent risk but can only be one level lower at most
   */
  private propagateRisk(parentRisk: "low" | "medium" | "high" | "critical"): "low" | "medium" | "high" {
    switch (parentRisk) {
      case "critical":
        return "high";
      case "high":
        return "medium";
      case "medium":
        return "low";
      case "low":
        return "low";
    }
  }

  private makeTask(domainId: string, description: string, goal: Goal, estimatedDuration: string): PlannedTask {
    const estimatedCost = this.options.costEstimator?.estimate(domainId) ?? DEFAULT_COST_ESTIMATE;
    const constraintEnvelope = parseConstraintEnvelope(goal);
    return {
      taskId: `${goal.goalId}:${domainId}:${description.slice(0, 12)}`,
      domainId,
      description,
      inputs: {
        goalDescription: goal.description,
        successCriteria: goal.successCriteria,
        constraints: goal.constraints,
        deadline: goal.deadline ?? null,
      },
      expectedOutputs: [`${domainId}_result`, "summary"],
      delegationMode: goal.priority === "critical" ? "manual" : goal.priority === "high" ? "supervised" : "auto",
      estimatedDuration,
      estimatedCost,
      constraintEnvelope,
    };
  }

  /**
   * R5-28: Validate domain capabilities against required capabilities for tasks
   * Returns validation result indicating if all required capabilities are available
   */
  private validateCapabilities(
    tasks: PlannedTask[],
    goalConstraintEnvelope?: GoalConstraintEnvelope,
  ): CapabilityValidationResult {
    const domainCapabilities = { ...DEFAULT_DOMAIN_CAPABILITIES, ...(this.options.domainCapabilities ?? {}) };
    const domainPermissions = DEFAULT_DOMAIN_PERMISSIONS;
    const missingCapabilities: string[] = [];
    const unauthorizedPermissions: string[] = [];
    const validationMessages: string[] = [];

    for (const task of tasks) {
      const availableCapabilities = domainCapabilities[task.domainId] ?? [];
      const availablePermissions = domainPermissions[task.domainId] ?? [];
      const required = task.constraintEnvelope?.requiredCapabilities ?? [];
      for (const capability of required) {
        if (!availableCapabilities.includes(capability)) {
          const capabilityMarker = `${task.domainId}:${capability}`;
          if (!missingCapabilities.includes(capabilityMarker)) {
            missingCapabilities.push(capabilityMarker);
            validationMessages.push(`goal_decomposer.missing_capability:${task.taskId}:${task.domainId}:${capability}`);
          }
        }
      }
      const requiredPermissions = goalConstraintEnvelope?.requiredPermissions ?? task.constraintEnvelope?.requiredPermissions ?? [];
      for (const permission of requiredPermissions) {
        if (!availablePermissions.includes(permission)) {
          const permissionMarker = `${task.domainId}:${permission}`;
          if (!unauthorizedPermissions.includes(permissionMarker)) {
            unauthorizedPermissions.push(permissionMarker);
            validationMessages.push(`goal_decomposer.unauthorized_permission:${task.taskId}:${task.domainId}:${permission}`);
          }
        }
      }
    }

    const valid = missingCapabilities.length === 0 && unauthorizedPermissions.length === 0;
    return {
      valid,
      missingCapabilities,
      unauthorizedPermissions,
      reasonCodes: [
        ...missingCapabilities.map((marker) => `goal_decomposer.missing_capabilities:${marker}`),
        ...unauthorizedPermissions.map((marker) => `goal_decomposer.unauthorized_permissions:${marker}`),
      ],
      validationMessages,
    };
  }

  private analyzeDependencyGraph(
    tasks: readonly PlannedTask[],
    dependencies: readonly TaskDependency[],
  ): {
    hasCycle: boolean;
    topologicallySortedTaskIds: string[];
    parallelTaskGroups: string[][];
    criticalPathTaskIds: string[];
    maxDependencyDepth: number;
  } {
    const taskIds = tasks.map((task) => task.taskId);
    const inDegree = new Map<string, number>(taskIds.map((taskId) => [taskId, 0]));
    const adjacency = new Map<string, string[]>(taskIds.map((taskId) => [taskId, []]));
    const reverse = new Map<string, string[]>(taskIds.map((taskId) => [taskId, []]));

    for (const dependency of dependencies) {
      adjacency.set(dependency.fromTask, [...(adjacency.get(dependency.fromTask) ?? []), dependency.toTask]);
      reverse.set(dependency.toTask, [...(reverse.get(dependency.toTask) ?? []), dependency.fromTask]);
      inDegree.set(dependency.toTask, (inDegree.get(dependency.toTask) ?? 0) + 1);
    }

    const queue = taskIds.filter((taskId) => (inDegree.get(taskId) ?? 0) === 0);
    const sorted: string[] = [];
    const levels = new Map<string, number>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      const parents = reverse.get(current) ?? [];
      levels.set(
        current,
        parents.length === 0 ? 0 : Math.max(...parents.map((taskId) => levels.get(taskId) ?? 0)) + 1,
      );
      for (const next of adjacency.get(current) ?? []) {
        const nextDegree = (inDegree.get(next) ?? 0) - 1;
        inDegree.set(next, nextDegree);
        if (nextDegree === 0) {
          queue.push(next);
        }
      }
    }

    const hasCycle = sorted.length !== taskIds.length;
    const maxDependencyDepth = levels.size === 0
      ? currentDepthFromTasks(tasks)
      : Math.max(...levels.values());
    const parallelGroups = hasCycle
      ? [taskIds]
      : [...new Set(levels.values())]
          .sort((left, right) => left - right)
          .map((level) => sorted.filter((taskId) => levels.get(taskId) === level));

    const durationByTask = new Map(tasks.map((task) => [task.taskId, parseDurationHours(task.estimatedDuration)]));
    const longestDistance = new Map<string, number>();
    const predecessor = new Map<string, string | null>();

    for (const taskId of hasCycle ? taskIds : sorted) {
      const parents = reverse.get(taskId) ?? [];
      if (parents.length === 0) {
        longestDistance.set(taskId, durationByTask.get(taskId) ?? 0);
        predecessor.set(taskId, null);
        continue;
      }
      let maxParentDistance = -1;
      let maxParent: string | null = null;
      for (const parent of parents) {
        const candidate = (longestDistance.get(parent) ?? 0) + (durationByTask.get(taskId) ?? 0);
        if (candidate > maxParentDistance) {
          maxParentDistance = candidate;
          maxParent = parent;
        }
      }
      longestDistance.set(taskId, Math.max(0, maxParentDistance));
      predecessor.set(taskId, maxParent);
    }

    if (hasCycle) {
      return {
        hasCycle,
        topologicallySortedTaskIds: taskIds,
        parallelTaskGroups: parallelGroups,
        criticalPathTaskIds: [],
        maxDependencyDepth,
      };
    }

    const criticalTail = [...longestDistance.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const criticalPath: string[] = [];
    const visited = new Set<string>();
    let cursor = criticalTail;
    while (cursor != null && !visited.has(cursor)) {
      visited.add(cursor);
      criticalPath.unshift(cursor);
      cursor = predecessor.get(cursor) ?? null;
    }

    return {
      hasCycle,
      topologicallySortedTaskIds: sorted,
      parallelTaskGroups: parallelGroups,
      criticalPathTaskIds: criticalPath,
      maxDependencyDepth,
    };
  }
}

function currentDepthFromTasks(tasks: readonly PlannedTask[]): number {
  return tasks.length > 0 ? 1 : 0;
}
