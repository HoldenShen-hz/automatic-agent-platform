import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import {
  createHarnessRun,
  createPlanGraphBundle,
  type BudgetLedger,
  type BudgetResourceKind,
  type HarnessRun,
  type PlanEdge,
  type PlanGraphBundle,
  type PlanNode,
  type RiskClass,
  type RiskPreview as ExecutableRiskPreview,
} from "../../platform/contracts/executable-contracts/index.js";
import {
  BudgetGuard,
  type BudgetPolicy,
} from "../../platform/model-gateway/cost-tracker/index.js";
import {
  PlanGraphAnalyzer,
  PlanGraphHarnessRuntime,
  type PlanGraphHarnessRuntimeContext,
  type PlanGraphHarnessRuntimeStepResult,
} from "../../platform/orchestration/harness/runtime/plan-graph-harness-runtime.js";
import type { RiskPreview } from "../nl-gateway/index.js";
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
  /** Delegation depth for this task (for anti-multiplication guard, per §19.2) */
  readonly delegationDepth?: number;
  /** Whether this task has been split from a parent goal (anti-multiplication guard) */
  readonly isSubdelegation?: boolean;
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
  readonly harnessRouting: GoalHarnessRoutingReceipt;
}

export type GoalLifecycleState =
  | "draft"
  | "decomposing"
  | "decomposed"
  | "partially_completed" // §40.5: goal partially completed (some subtasks done)
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export interface GoalConstraintEnvelope {
  readonly budgetLimitUsd: number | null;
  /** §40.2: Budget proportionally allocated to subtasks */
  readonly budgetAllocations?: readonly { taskId: string; budgetUsd: number; riskMultiplier: number }[];
  /** §40.2: Risk propagation to subtasks */
  readonly riskPropagation?: readonly { taskId: string; riskLevel: "low" | "medium" | "high" | "critical" }[];
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
  readonly state: "ready_for_planner";
  readonly graphId: string;
  readonly constraintEnvelope: GoalConstraintEnvelope;
  readonly budgetLedgerId?: string;
  readonly budgetReservationId?: string;
  readonly reservedBudgetUsd?: number | null;
  readonly harnessRunId?: string;
  readonly planGraphBundleId?: string;
  readonly initialNodeRunId?: string;
  readonly initialReceiptStatus?: PlanGraphHarnessRuntimeStepResult["receipt"]["status"];
  readonly routedAt?: string;
}

export interface GoalHarnessRoutingReceipt {
  readonly harnessRun: HarnessRun;
  readonly planGraphBundle: PlanGraphBundle;
  readonly initialStep: PlanGraphHarnessRuntimeStepResult;
  readonly routedAt: string;
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
  /** Maximum delegation chain depth (default: 3 per §19.2) */
  readonly maxDelegationDepth?: number;
  /** Global call depth hard cap (default: 8 per §19.2) */
  readonly callDepth?: number;
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
  readonly planGraphHarnessRuntime?: PlanGraphHarnessRuntime | null;
  readonly planGraphAnalyzer?: PlanGraphAnalyzer | null;
  readonly harnessRuntimeContext?: Partial<PlanGraphHarnessRuntimeContext>;
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
/** Default maximum delegation chain depth (per §19.2) */
const DEFAULT_MAX_DELEGATION_DEPTH = 3;
/** Default global call depth hard cap (per §19.2) */
const DEFAULT_CALL_DEPTH = 8;
const DEFAULT_LLM_PLAN_LATENCY_MS = 10_000;
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
  return {
    goalId: `goal:${goal.slice(0, 16)}`,
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

function parseConstraintEnvelope(goal: Goal, tasks?: readonly PlannedTask[]): GoalConstraintEnvelope {
  const rawConstraints = [goal.description, ...goal.constraints].join(" ");
  const budgetMatch = /(?:budget|预算|费用)\D*(\d+(?:\.\d+)?)/i.exec(rawConstraints);
  const budgetLimitUsd = budgetMatch == null ? null : Number.parseFloat(budgetMatch[1]!);
  const requiredPermissions = [
    ...( /(deploy|release|publish|上线|发布)/i.test(rawConstraints) ? ["deployment:write"] : []),
    ...( /(delete|drop|remove|删除|清空)/i.test(rawConstraints) ? ["destructive:write"] : []),
  ];
  const requiredCapabilities = [
    ...( /(dashboard|report|报表|roi|分析)/i.test(rawConstraints) ? ["analytics"] : []),
    ...( /(approval|审批)/i.test(rawConstraints) ? ["approval_workflow"] : []),
  ];

  // §40.2: Proportional budget allocation to subtasks
  const budgetAllocations: GoalConstraintEnvelope["budgetAllocations"] = tasks && tasks.length > 0 && budgetLimitUsd != null
    ? tasks.map((task, index) => {
        // Proportional allocation based on estimated cost ratio
        const taskCostRatio = task.estimatedCost.estimatedCostUsd > 0
          ? task.estimatedCost.estimatedCostUsd / tasks.reduce((sum, t) => sum + t.estimatedCost.estimatedCostUsd, 0)
          : 1 / tasks.length;
        const taskBudget = Number((budgetLimitUsd * taskCostRatio).toFixed(4));
        // Risk multiplier: critical=2.0, high=1.5, medium=1.2, low=1.0
        const riskMultiplier = task.constraintEnvelope?.riskTolerance === "critical" ? 2.0
          : task.constraintEnvelope?.riskTolerance === "high" ? 1.5
          : task.constraintEnvelope?.riskTolerance === "medium" ? 1.2
          : 1.0;
        return { taskId: task.taskId, budgetUsd: taskBudget, riskMultiplier };
      })
    : undefined;

  // §40.2: Risk propagation to subtasks
  const goalRisk: "low" | "medium" | "high" | "critical" =
    goal.priority === "critical" ? "critical"
    : goal.priority === "high" ? "high"
    : HIGH_RISK_KEYWORDS.some(k => rawConstraints.toLowerCase().includes(k)) ? "high"
    : "medium";
  const riskPropagation: GoalConstraintEnvelope["riskPropagation"] = tasks && tasks.length > 0
    ? tasks.map(task => ({
        taskId: task.taskId,
        riskLevel: task.constraintEnvelope?.riskTolerance ?? goalRisk,
      }))
    : undefined;

  return {
    budgetLimitUsd,
    budgetAllocations,
    riskPropagation,
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

export class GoalDecompositionService implements GoalDecompositionPort {
  public constructor(private readonly options: GoalDecompositionServiceOptions = {}) {}

  public async decompose(goalInput: Goal | string): Promise<GoalDecomposition> {
    const maxDepth = this.options.maxDepth ?? DEFAULT_MAX_DEPTH;
    const currentDepth = this.options.currentDepth ?? 0;
    const maxDelegationDepth = this.options.maxDelegationDepth ?? DEFAULT_MAX_DELEGATION_DEPTH;
    const callDepth = this.options.callDepth ?? DEFAULT_CALL_DEPTH;
    const maxDepthReached = currentDepth >= maxDepth;

    // §19.2: Enforce delegation chain depth limit and global call_depth hard cap
    if (currentDepth > maxDelegationDepth) {
      throw new Error(`goal_decomposer.delegation_depth_exceeded: max=${maxDelegationDepth}, current=${currentDepth}`);
    }
    if (currentDepth > callDepth) {
      throw new Error(`goal_decomposer.call_depth_exceeded: max=${callDepth}, current=${currentDepth}`);
    }

    const goal = normalizeGoal(goalInput);
    const rawConstraintEnvelope = parseConstraintEnvelope(goal);
    const matchedTemplate = this.detectTemplate(goal.description);
    let tasks = this.buildTasks(goal, matchedTemplate);

    // §40.2: Proportional budget allocation to subtasks
    // Distribute the goal's budget proportionally based on task costs and risk levels
    const riskMultiplierMap: Record<string, number> = {
      low: 1.0,
      medium: 1.5,
      high: 2.0,
      critical: 3.0,
    };
    const totalEstimatedTaskCostUsd = tasks.reduce((sum, t) => sum + t.estimatedCost.estimatedCostUsd, 0);
    const budgetAllocations = rawConstraintEnvelope.budgetLimitUsd != null
      ? tasks.map((task) => {
          const proportion = totalEstimatedTaskCostUsd > 0
            ? task.estimatedCost.estimatedCostUsd / totalEstimatedTaskCostUsd
            : 1 / tasks.length;
          const riskMultiplier = riskMultiplierMap[task.constraintEnvelope?.riskTolerance ?? "medium"] ?? 1.5;
          return {
            taskId: task.taskId,
            budgetUsd: Number((rawConstraintEnvelope.budgetLimitUsd * proportion).toFixed(4)),
            riskMultiplier,
          };
        })
      : [];

    // §40.2: Risk propagation to subtasks
    const riskPropagation = tasks.map((task) => {
      const taskRisk = task.constraintEnvelope?.riskTolerance ?? "medium";
      return {
        taskId: task.taskId,
        riskLevel: taskRisk as "low" | "medium" | "high" | "critical",
      };
    });

    const constraintEnvelope: GoalConstraintEnvelope = {
      ...rawConstraintEnvelope,
      budgetAllocations,
      riskPropagation,
    };
    let dependencyGraph = this.buildDependencies(tasks, matchedTemplate);
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
          // The top-level decomposer only performs policy gating.
          // The concrete LLM plan generator owns reservation/settlement to avoid double reservation.
          const evaluation = guard.evaluateExecutionChain({
            policy: this.options.budgetControl.policy,
            spend: {
              currentTaskCostUsd: this.options.budgetControl.currentTaskCostUsd ?? 0,
              currentPackCostUsd: this.options.budgetControl.currentDailyCostUsd ?? 0,
              currentPlatformCostUsd: this.options.budgetControl.currentMonthlyCostUsd ?? 0,
              currentDailyCostUsd: this.options.budgetControl.currentDailyCostUsd ?? 0,
              currentMonthlyCostUsd: this.options.budgetControl.currentMonthlyCostUsd ?? 0,
              nextEstimatedCostUsd: this.options.budgetControl.estimatedLlmPlanCostUsd ?? 0.25,
            },
          });
          budgetBlockedLlmPlan = !evaluation.allowed;
          if (budgetBlockedLlmPlan) {
            throw new Error("goal_decomposer.budget_reservation_required");
          }
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
    const estimatedCost = totalCost(tasks.map((task) => task.estimatedCost));
    const riskSummary = buildRiskSummary(goal, matchedTemplate);
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
      ...(constraintEnvelope.requiresApproval ? ["goal_decomposer.approval_constraint_propagated"] : []),
      ...(budgetBlockedLlmPlan ? ["goal_decomposer.llm_budget_reservation_blocked"] : []),
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
      state: "ready_for_planner",
      graphId: taskGraphDraft.graphId,
      constraintEnvelope,
    };
    const harnessRouting = this.routeToHarness(goal, tasks, dependencyGraph, riskSummary);
    const routedPlannerHandoff: PlannerHandoffReceipt = {
      ...plannerHandoff,
      harnessRunId: harnessRouting.harnessRun.harnessRunId,
      planGraphBundleId: harnessRouting.planGraphBundle.planGraphBundleId,
      initialNodeRunId: harnessRouting.initialStep.nodeRun.nodeRunId,
      initialReceiptStatus: harnessRouting.initialStep.receipt.status,
      routedAt: harnessRouting.routedAt,
    };

    return {
      goalId: goal.goalId,
      tasks,
      dependencyGraph,
      estimatedDuration: `${Math.max(1, tasks.length)}d`,
      estimatedCost,
      riskSummary,
      decompositionConfidence,
      requiresHumanReview:
        decompositionConfidence < 0.7
        || riskSummary.overallRisk === "critical"
        || goal.priority === "critical"
        || graphAnalysis.hasCycle,
      decompositionStrategy,
      topologicallySortedTaskIds: graphAnalysis.topologicallySortedTaskIds,
      parallelTaskGroups: graphAnalysis.parallelTaskGroups,
      criticalPathTaskIds: graphAnalysis.criticalPathTaskIds,
      depthUsed: currentDepth,
      maxDepthReached,
      lifecycleState,
      goalGraphDraft,
      taskGraphDraft,
      plannerHandoff: routedPlannerHandoff,
      harnessRouting,
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
    const normalized = description.toLowerCase();
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

  private buildTasks(goal: Goal, template: ReturnType<GoalDecompositionService["detectTemplate"]>): PlannedTask[] {
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

  private makeTask(domainId: string, description: string, goal: Goal, estimatedDuration: string, options?: { delegationDepth?: number; isSubdelegation?: boolean }): PlannedTask {
    const estimatedCost = this.options.costEstimator?.estimate(domainId) ?? DEFAULT_COST_ESTIMATE;
    const constraintEnvelope = parseConstraintEnvelope(goal);
    const delegationDepth = options?.delegationDepth ?? 0;
    const maxDelegationDepth = this.options.maxDelegationDepth ?? DEFAULT_MAX_DELEGATION_DEPTH;

    // §19.2: Anti-multiplication guard - prevent re-delegating already-delegated tasks
    const isSubdelegation = (options?.isSubdelegation ?? false) || delegationDepth >= maxDelegationDepth;

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
      delegationDepth,
      isSubdelegation,
    };
  }

  private routeToHarness(
    goal: Goal,
    tasks: readonly PlannedTask[],
    dependencyGraph: readonly TaskDependency[],
    riskSummary: RiskPreview,
  ): GoalHarnessRoutingReceipt {
    const harnessContext = this.buildHarnessRuntimeContext(goal);
    const bootstrapRun = createHarnessRun({
      harnessRunId: `${goal.goalId}:harness_run`,
      tenantId: harnessContext.tenantId,
      confirmedTaskSpecId: `${goal.goalId}:confirmed_task_spec`,
      requestEnvelopeId: `${goal.goalId}:request_envelope`,
      requestHash: `${goal.goalId}:request_hash`,
      constraintPackRef: `${goal.goalId}:constraint_pack`,
      versionLockId: `${goal.goalId}:version_lock`,
      budgetLedgerId: this.options.budgetControl?.ledger?.budgetLedgerId ?? `${goal.goalId}:budget_ledger`,
    });
    const graphNodes = this.buildPlanNodes(tasks, riskSummary);
    const graphEdges = this.buildPlanEdges(dependencyGraph);
    const planGraphBundle = (this.options.planGraphAnalyzer ?? new PlanGraphAnalyzer()).normalize(createPlanGraphBundle({
      planGraphBundleId: `${goal.goalId}:plan_graph_bundle`,
      harnessRunId: bootstrapRun.harnessRunId,
      graph: {
        graphId: `${goal.goalId}:plan_graph`,
        nodes: graphNodes,
        edges: graphEdges,
        entryNodeIds: graphNodes
          .filter((node) => graphEdges.every((edge) => edge.toNodeId !== node.nodeId))
          .map((node) => node.nodeId),
        terminalNodeIds: graphNodes
          .filter((node) => graphEdges.every((edge) => edge.fromNodeId !== node.nodeId))
          .map((node) => node.nodeId),
        joinStrategy: "all",
        graphHash: [
          goal.goalId,
          ...graphNodes.map((node) => node.nodeId),
          ...graphEdges.map((edge) => `${edge.fromNodeId}->${edge.toNodeId}`),
        ].join("|"),
      },
      schedulerPolicy: {
        policyId: `${goal.goalId}:scheduler_policy`,
        strategy: "deterministic_fifo",
      },
      budgetPlanRef: `${goal.goalId}:budget_plan`,
      riskProfile: this.toExecutableRiskProfile(riskSummary),
    }));
    const harnessRun = createHarnessRun({
      harnessRunId: bootstrapRun.harnessRunId,
      tenantId: bootstrapRun.tenantId,
      confirmedTaskSpecId: bootstrapRun.confirmedTaskSpecId,
      requestEnvelopeId: bootstrapRun.requestEnvelopeId,
      requestHash: bootstrapRun.requestHash,
      constraintPackRef: bootstrapRun.constraintPackRef,
      versionLockId: bootstrapRun.versionLockId,
      budgetLedgerId: bootstrapRun.budgetLedgerId,
      planGraphBundleId: planGraphBundle.planGraphBundleId,
      createdAt: bootstrapRun.createdAt,
      updatedAt: bootstrapRun.updatedAt,
    });
    const initialStep = (this.options.planGraphHarnessRuntime ?? new PlanGraphHarnessRuntime()).executeNext({
      harnessRun,
      planGraphBundle,
      context: harnessContext,
    });

    return {
      harnessRun,
      planGraphBundle,
      initialStep,
      routedAt: nowIso(),
    };
  }

  private buildHarnessRuntimeContext(goal: Goal): PlanGraphHarnessRuntimeContext {
    return {
      tenantId: this.options.harnessRuntimeContext?.tenantId ?? this.options.budgetControl?.tenantId ?? "tenant:local",
      traceId: this.options.harnessRuntimeContext?.traceId ?? this.options.budgetControl?.traceId ?? `trace:${goal.goalId}`,
      emittedBy: this.options.harnessRuntimeContext?.emittedBy ?? this.options.budgetControl?.emittedBy ?? "goal-decomposer",
      executorRef: this.options.harnessRuntimeContext?.executorRef ?? "goal-decomposer.harness-router",
    };
  }

  private buildPlanNodes(tasks: readonly PlannedTask[], riskSummary: RiskPreview): PlanNode[] {
    return tasks.map((task) => {
      const nodeType = this.resolvePlanNodeType(task);
      return {
        nodeId: task.taskId,
        nodeType,
        inputRefs: task.dependsOn ?? [],
        outputSchemaRef: `schema://goal-decomposer/${task.taskId}/output`,
        riskClass: this.resolveTaskRiskClass(task, riskSummary),
        budgetIntent: {
          amount: Number(task.estimatedCost.estimatedCostUsd.toFixed(4)),
          currency: "USD",
          resourceKinds: [this.options.budgetControl?.resourceKind ?? (nodeType === "llm" ? "llm" : "tool")],
        },
        sideEffectProfile: {
          mayCommitExternalEffect: /(deploy|release|publish|advertising|operations)/i.test(`${task.domainId} ${task.description}`),
          reversible: !/(delete|drop|remove|rollback|revoke|删除|清空)/i.test(task.description),
        },
        retryPolicyRef: `retry://goal-decomposer/${task.taskId}`,
        timeoutMs: Math.max(60_000, parseDurationHours(task.estimatedDuration) * 60 * 60 * 1000),
      };
    });
  }

  private buildPlanEdges(dependencyGraph: readonly TaskDependency[]): PlanEdge[] {
    return dependencyGraph.map((dependency, index) => ({
      edgeId: `${dependency.fromTask}->${dependency.toTask}:${index + 1}`,
      fromNodeId: dependency.fromTask,
      toNodeId: dependency.toTask,
      condition: dependency.dataContract == null ? {} : { dataContract: dependency.dataContract },
      dependencyType: dependency.type === "soft_dependency" ? "soft" : "hard",
    }));
  }

  private resolvePlanNodeType(task: PlannedTask): PlanNode["nodeType"] {
    if (task.delegationMode === "manual" || task.constraintEnvelope?.requiresApproval === true) {
      return "hitl_wait";
    }
    if (/(analysis|content|general_ops|legal|finance|hr|communications)/i.test(task.domainId)) {
      return "llm";
    }
    return "tool";
  }

  private resolveTaskRiskClass(task: PlannedTask, riskSummary: RiskPreview): RiskClass {
    const taskRisk = task.constraintEnvelope?.riskTolerance;
    if (taskRisk === "critical" || riskSummary.overallRisk === "critical") {
      return "critical";
    }
    if (taskRisk === "high" || riskSummary.overallRisk === "high") {
      return "high";
    }
    if (taskRisk === "medium" || riskSummary.overallRisk === "medium") {
      return "medium";
    }
    return "low";
  }

  private toExecutableRiskProfile(riskSummary: RiskPreview): ExecutableRiskPreview {
    return {
      riskClass: riskSummary.overallRisk === "critical"
        ? "critical"
        : riskSummary.overallRisk === "high"
          ? "high"
          : riskSummary.overallRisk === "medium"
            ? "medium"
            : "low",
      reasons: riskSummary.riskFactors,
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

    const criticalTail = [...longestDistance.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const criticalPath: string[] = [];
    let cursor = criticalTail;
    while (cursor != null) {
      criticalPath.unshift(cursor);
      cursor = predecessor.get(cursor) ?? null;
    }

    return {
      hasCycle,
      topologicallySortedTaskIds: hasCycle ? taskIds : sorted,
      parallelTaskGroups: parallelGroups,
      criticalPathTaskIds: criticalPath,
    };
  }
}
