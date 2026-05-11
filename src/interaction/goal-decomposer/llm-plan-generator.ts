import type { UnifiedChatProvider } from "../../platform/model-gateway/provider-registry/index.js";
import type {
  BudgetLedger,
  BudgetResourceKind,
} from "../../platform/contracts/executable-contracts/index.js";
import { BudgetAllocator } from "../../platform/execution/budget-allocator.js";
import type { Goal, PlannedTask, TaskDependency } from "./index.js";

export interface LlmPlan {
  readonly tasks: readonly PlannedTask[];
  readonly dependencyGraph: readonly TaskDependency[];
}

export interface LlmPlanGenerator {
  readonly managesBudgetReservations?: boolean;
  generate(goal: Goal): Promise<LlmPlan>;
}

export interface UnifiedChatPlanGeneratorOptions {
  readonly provider: UnifiedChatProvider;
  readonly model?: string;
  readonly budgetControl?: {
    readonly allocator?: BudgetAllocator;
    readonly ledger: BudgetLedger;
    readonly estimatedCostUsd: number;
    readonly tenantId: string;
    readonly traceId: string;
    readonly emittedBy: string;
    readonly expiresAt?: string;
    readonly resourceKind?: BudgetResourceKind;
  };
}

interface SerializableTask {
  readonly domainId: string;
  readonly description: string;
  readonly expectedOutputs: readonly string[];
  readonly delegationMode: PlannedTask["delegationMode"];
  readonly estimatedDuration: string;
  readonly estimatedCostUsd: number;
}

interface SerializablePlan {
  readonly tasks: readonly SerializableTask[];
  readonly dependencyGraph: readonly TaskDependency[];
}

function assertValidSerializableTask(task: SerializableTask, index: number): void {
  if (task.domainId.trim().length === 0 || task.description.trim().length === 0) {
    throw new Error(`goal_decomposer.invalid_llm_plan_task:${index}`);
  }
  if (!["auto", "supervised", "manual"].includes(task.delegationMode)) {
    throw new Error(`goal_decomposer.invalid_llm_plan_delegation_mode:${index}`);
  }
  if (!Array.isArray(task.expectedOutputs)) {
    throw new Error(`goal_decomposer.invalid_llm_plan_expected_outputs:${index}`);
  }
}

function validateDependencyGraph(taskIds: readonly string[], dependencyGraph: readonly TaskDependency[]): void {
  const taskIdSet = new Set(taskIds);
  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const taskId of taskIds) {
    adjacency.set(taskId, []);
    indegree.set(taskId, 0);
  }

  for (const edge of dependencyGraph) {
    if (!taskIdSet.has(edge.fromTask) || !taskIdSet.has(edge.toTask)) {
      throw new Error("goal_decomposer.invalid_llm_plan_dependency_reference");
    }
    if (edge.fromTask === edge.toTask) {
      throw new Error("goal_decomposer.invalid_llm_plan_self_cycle");
    }
    adjacency.get(edge.fromTask)!.push(edge.toTask);
    indegree.set(edge.toTask, (indegree.get(edge.toTask) ?? 0) + 1);
  }

  const queue = taskIds.filter((taskId) => (indegree.get(taskId) ?? 0) === 0);
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited += 1;
    for (const next of adjacency.get(current) ?? []) {
      const nextIndegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(next);
      }
    }
  }

  if (visited !== taskIds.length) {
    throw new Error("goal_decomposer.invalid_llm_plan_cycle_detected");
  }
}

interface GoalBudgetEnvelope {
  readonly totalBudgetUsd: number | null;
  readonly requiresApproval: boolean;
  readonly riskTolerance: "low" | "medium" | "high";
}

function parseGoalBudgetEnvelope(goal: Goal): GoalBudgetEnvelope {
  const raw = [goal.description, ...goal.constraints].join(" ");
  const budgetMatch = /(?:budget|预算|费用)\D*(\d+(?:\.\d+)?)/i.exec(raw);
  return {
    totalBudgetUsd: budgetMatch == null ? null : Number.parseFloat(budgetMatch[1]!),
    requiresApproval: /(approval|审批|deploy|release|publish|delete|删除)/i.test(raw),
    riskTolerance: goal.priority === "critical" ? "low" : goal.priority === "high" ? "medium" : "high",
  };
}

function allocateBudgetShare(
  totalBudgetUsd: number | null,
  taskEstimatedCostUsd: number,
  totalEstimatedCostUsd: number,
  taskCount: number,
): number | null {
  if (totalBudgetUsd == null) {
    return null;
  }
  if (totalEstimatedCostUsd <= 0) {
    return Number((totalBudgetUsd / Math.max(1, taskCount)).toFixed(4));
  }
  return Number(((taskEstimatedCostUsd / totalEstimatedCostUsd) * totalBudgetUsd).toFixed(4));
}

function deriveEstimateConfidence(goal: Goal, goalBudget: GoalBudgetEnvelope, taskCount: number): PlannedTask["estimatedCost"]["confidence"] {
  const evidenceSignals = goal.successCriteria.length + goal.constraints.length + taskCount;
  // Prioritize critical/high goals regardless of evidence signals
  if (goal.priority === "critical") {
    return "high";
  }
  if (goal.priority === "high" && evidenceSignals >= 2) {
    return "high";
  }
  if (goalBudget.totalBudgetUsd != null && evidenceSignals >= 4) {
    return "high";
  }
  if (evidenceSignals >= 2) {
    return "medium";
  }
  return "low";
}

function deriveEstimateSampleCount(goal: Goal, taskCount: number): number {
  // Sample count reflects the evidence available for the cost estimate
  // Higher when goal has explicit success criteria and constraints
  const base = goal.successCriteria.length + goal.constraints.length;
  const taskContribution = Math.min(taskCount * 2, 10); // Cap task contribution at 10
  return Math.max(1, base + taskContribution);
}

/**
 * Derives per-task estimate confidence based on task-specific signals.
 * Tasks with more explicit outputs and longer descriptions get higher confidence.
 */
function derivePerTaskConfidence(
  taskDescription: string,
  expectedOutputCount: number,
  baseConfidence: PlannedTask["estimatedCost"]["confidence"],
): PlannedTask["estimatedCost"]["confidence"] {
  const descriptionLength = taskDescription.length;
  // Richer task descriptions suggest more thought went into planning
  const richnessBoost = descriptionLength > 80 ? 1 : descriptionLength > 40 ? 0 : -1;
  const outputBonus = expectedOutputCount > 2 ? 1 : 0;

  const confidenceOrder = ["low", "medium", "high"] as const;
  // Map "default" to "medium" baseline
  const baseIndex = baseConfidence === "default" ? 1 : confidenceOrder.indexOf(baseConfidence);
  const adjustedIndex = Math.max(0, Math.min(2, baseIndex + richnessBoost + outputBonus));
  return confidenceOrder[adjustedIndex] ?? "medium";
}

export class UnifiedChatPlanGenerator implements LlmPlanGenerator {
  private readonly model: string;
  public readonly managesBudgetReservations: boolean;

  public constructor(private readonly options: UnifiedChatPlanGeneratorOptions) {
    this.model = options.model ?? "gpt-4o-mini";
    this.managesBudgetReservations = options.budgetControl != null;
  }

  public async generate(goal: Goal): Promise<LlmPlan> {
    const allocator = this.options.budgetControl?.allocator ?? new BudgetAllocator();
    const reservedBudget = this.options.budgetControl == null
      ? null
      : allocator.reserve({
        ledger: this.options.budgetControl.ledger,
        amount: Number(this.options.budgetControl.estimatedCostUsd.toFixed(4)),
        resourceKind: this.options.budgetControl.resourceKind ?? "token",
        expiresAt: this.options.budgetControl.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        expectedVersion: this.options.budgetControl.ledger.version,
        context: {
          tenantId: this.options.budgetControl.tenantId,
          traceId: this.options.budgetControl.traceId,
          emittedBy: this.options.budgetControl.emittedBy,
          principal: this.options.budgetControl.emittedBy,
        },
      });

    try {
      const response = await this.options.provider.complete(this.buildPrompt(goal), {
        model: this.model,
        system:
          "You are a goal decomposition planner. Return strict JSON only with tasks and dependencyGraph. No markdown.",
        temperature: 0.1,
        maxTokens: 1200,
        ...(this.options.budgetControl?.traceId !== undefined ? { traceId: this.options.budgetControl.traceId } : {}),
        ...(this.options.budgetControl?.tenantId !== undefined ? { tenantId: this.options.budgetControl.tenantId } : {}),
        costTag: "goal_decomposer.llm_plan",
      });
      const parsed = this.parsePlan(response);
      const goalBudget = parseGoalBudgetEnvelope(goal);
      const totalEstimatedCostUsd = parsed.tasks.reduce((sum, task) => sum + task.estimatedCostUsd, 0);
      const estimateConfidence = deriveEstimateConfidence(goal, goalBudget, parsed.tasks.length);
      const estimateSampleCount = deriveEstimateSampleCount(goal, parsed.tasks.length);
      if (reservedBudget != null) {
        allocator.settle({
          ledger: reservedBudget.ledger,
          reservation: reservedBudget.reservation,
          actualAmount: Number(this.options.budgetControl!.estimatedCostUsd.toFixed(4)),
          context: {
            principal: this.options.budgetControl!.emittedBy,
            tenantId: this.options.budgetControl!.tenantId,
            traceId: this.options.budgetControl!.traceId,
            emittedBy: this.options.budgetControl!.emittedBy,
          },
        });
      }

      return {
        tasks: parsed.tasks.map((task, index) => ({
          taskId: `${goal.goalId}:llm:${index + 1}`,
          domainId: task.domainId,
          description: task.description,
          inputs: {
            goalDescription: goal.description,
            successCriteria: goal.successCriteria,
            constraints: goal.constraints,
            deadline: goal.deadline ?? null,
            priority: goal.priority,
            allocatedBudgetUsd: allocateBudgetShare(
              goalBudget.totalBudgetUsd,
              task.estimatedCostUsd,
              totalEstimatedCostUsd,
              parsed.tasks.length,
            ),
          },
          expectedOutputs: task.expectedOutputs,
          delegationMode: task.delegationMode,
          estimatedDuration: task.estimatedDuration,
          estimatedCost: {
            estimatedCostUsd: Number(task.estimatedCostUsd.toFixed(4)),
            confidence: derivePerTaskConfidence(task.description, task.expectedOutputs.length, estimateConfidence),
            sampleCount: estimateSampleCount,
            divisionId: task.domainId,
            basedOn: "llm_estimate",
          },
          constraintEnvelope: {
            budgetLimitUsd: allocateBudgetShare(
              goalBudget.totalBudgetUsd,
              task.estimatedCostUsd,
              totalEstimatedCostUsd,
              parsed.tasks.length,
            ),
            riskTolerance: goalBudget.riskTolerance,
            requiresApproval: goalBudget.requiresApproval || task.delegationMode !== "auto",
            requiredPermissions: [],
            requiredCapabilities: [task.domainId],
          },
        })),
        dependencyGraph: parsed.dependencyGraph.map((edge) => ({
          ...edge,
          fromTask: this.normalizeTaskReference(goal.goalId, edge.fromTask),
          toTask: this.normalizeTaskReference(goal.goalId, edge.toTask),
        })),
      };
    } catch (error) {
      if (reservedBudget != null) {
        allocator.release({
          ledger: reservedBudget.ledger,
          reservation: reservedBudget.reservation,
          reasonCode: "budget.goal_decomposer_llm_plan_failed",
          context: {
            principal: this.options.budgetControl!.emittedBy,
            tenantId: this.options.budgetControl!.tenantId,
            traceId: this.options.budgetControl!.traceId,
            emittedBy: this.options.budgetControl!.emittedBy,
          },
        });
      }
      throw error;
    }
  }

  private buildPrompt(goal: Goal): string {
    return JSON.stringify(
      {
        goal,
        requirements: {
          taskCount: "3-6",
          returnShape: {
            tasks: [
              {
                domainId: "string",
                description: "string",
                expectedOutputs: ["string"],
                delegationMode: "auto|supervised|manual",
                estimatedDuration: "string like 2h or 1d",
                estimatedCostUsd: 0.1,
              },
            ],
            dependencyGraph: [
              {
                fromTask: "task index starting from 1 or generated task id",
                toTask: "task index starting from 1 or generated task id",
                type: "blocks|provides_input|soft_dependency",
                dataContract: "optional string",
              },
            ],
          },
        },
      },
      null,
      2,
    );
  }

  private parsePlan(response: string): SerializablePlan {
    const trimmed = response.trim();
    const normalized = trimmed.startsWith("```")
      ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      : trimmed;
    const parsed = JSON.parse(normalized) as SerializablePlan;
    if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.dependencyGraph)) {
      throw new Error("goal_decomposer.invalid_llm_plan_shape");
    }
    parsed.tasks.forEach((task, index) => assertValidSerializableTask(task, index));
    const taskIds = parsed.tasks.map((_, index) => this.normalizeTaskReference("plan", String(index + 1)));
    validateDependencyGraph(
      taskIds,
      parsed.dependencyGraph.map((edge) => ({
        ...edge,
        fromTask: this.normalizeTaskReference("plan", edge.fromTask),
        toTask: this.normalizeTaskReference("plan", edge.toTask),
      })),
    );
    return parsed;
  }

  private normalizeTaskReference(goalId: string, ref: string): string {
    const numeric = Number(ref);
    if (Number.isInteger(numeric) && numeric > 0) {
      return `${goalId}:llm:${numeric}`;
    }
    if (ref.startsWith(`${goalId}:llm:`)) {
      return ref;
    }
    return `${goalId}:llm:${ref}`;
  }
}
