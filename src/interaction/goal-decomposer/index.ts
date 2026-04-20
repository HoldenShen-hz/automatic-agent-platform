import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import type { RiskPreview } from "../nl-gateway/index.js";

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
}

export type GoalDecompositionResult = GoalDecomposition;

export interface GoalDecompositionPort {
  decompose(goal: Goal | string): Promise<GoalDecomposition>;
}

export interface GoalDecompositionServiceOptions {
  readonly costEstimator?: { estimate(divisionId?: string | null): CostEstimate } | null;
  /** Maximum decomposition depth to prevent infinite recursion (default: 5) */
  readonly maxDepth?: number;
  /** Current decomposition depth (used internally, do not set manually) */
  readonly currentDepth?: number;
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
  const critical = goal.priority === "critical";
  const high = critical || /(deploy|release|publish|price|budget|审批|上线|投放)/i.test(goal.description);

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
    const maxDepthReached = currentDepth >= maxDepth;

    const goal = normalizeGoal(goalInput);
    const matchedTemplate = this.detectTemplate(goal.description);
    const tasks = this.buildTasks(goal, matchedTemplate);
    const dependencyGraph = this.buildDependencies(tasks, matchedTemplate);
    const graphAnalysis = this.analyzeDependencyGraph(tasks, dependencyGraph);
    const estimatedCost = totalCost(tasks.map((task) => task.estimatedCost));
    const riskSummary = buildRiskSummary(goal, matchedTemplate);
    const decompositionConfidence = matchedTemplate == null ? 0.62 : matchedTemplate === "generic_multi_step" ? 0.74 : 0.88;

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
      decompositionStrategy: matchedTemplate == null
        ? "human_assisted"
        : matchedTemplate === "generic_multi_step"
          ? "hybrid"
          : "template",
      topologicallySortedTaskIds: graphAnalysis.topologicallySortedTaskIds,
      parallelTaskGroups: graphAnalysis.parallelTaskGroups,
      criticalPathTaskIds: graphAnalysis.criticalPathTaskIds,
      depthUsed: currentDepth,
      maxDepthReached,
    };
  }

  private detectTemplate(description: string): "marketing_campaign" | "release_launch" | "incident_response" | "hiring_pipeline" | "generic_multi_step" | null {
    const normalized = description.toLowerCase();
    if (/(campaign|marketing|广告|投放|素材)/i.test(description)) {
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

  private makeTask(domainId: string, description: string, goal: Goal, estimatedDuration: string): PlannedTask {
    const estimatedCost = this.options.costEstimator?.estimate(domainId) ?? DEFAULT_COST_ESTIMATE;
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
