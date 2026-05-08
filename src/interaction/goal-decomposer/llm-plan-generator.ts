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
  if (goalBudget.totalBudgetUsd != null && evidenceSignals >= 4) {
    return "high";
  }
  if (evidenceSignals >= 2) {
    return "medium";
  }
  return "low";
}

function deriveEstimateSampleCount(goal: Goal, taskCount: number): number {
  return Math.max(1, goal.successCriteria.length + goal.constraints.length + taskCount);
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
            confidence: estimateConfidence,
            sampleCount: estimateSampleCount,
            divisionId: task.domainId,
            basedOn: "default",
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
