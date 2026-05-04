import type { CostEstimate } from "../../platform/contracts/types/cost.js";
import type { UnifiedChatProvider } from "../../platform/model-gateway/provider-registry/index.js";
import type {
  BudgetLedger,
  BudgetResourceKind,
} from "../../platform/contracts/executable-contracts/index.js";
import { BudgetAllocator, BudgetTier, type BudgetAllocatorContext } from "../../platform/five-plane-execution/budget-allocator.js";
import type { Goal, PlannedTask, TaskDependency } from "./index.js";

// Default budget allocator context settings for goal decomposition
const DEFAULT_BUDGET_CONTEXT: Omit<BudgetAllocatorContext, "tenantId" | "traceId" | "emittedBy"> = {
  tier: BudgetTier.STEP,
  tierLimit: 100,
  watermarkAlert: { warningThreshold: 0.7, criticalThreshold: 0.9, hardCapThreshold: 1.0 },
  autoThrottle: { enabled: false, throttleRatio: 0.5, recoveryRatio: 0.1 },
  crossRunPriority: { priority: 0, weightFactor: 1.0 },
  streamingSettle: { enabled: false, tokenInterval: 1000, timeIntervalMs: 5000 },
};

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
          ...DEFAULT_BUDGET_CONTEXT,
          tenantId: this.options.budgetControl.tenantId,
          traceId: this.options.budgetControl.traceId,
          emittedBy: this.options.budgetControl.emittedBy,
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
      if (reservedBudget != null) {
        allocator.settle({
          ledger: reservedBudget.ledger,
          reservation: reservedBudget.reservation,
          actualAmount: Number(this.options.budgetControl!.estimatedCostUsd.toFixed(4)),
          context: {
            ...DEFAULT_BUDGET_CONTEXT,
            tenantId: this.options.budgetControl!.tenantId,
            traceId: this.options.budgetControl!.traceId,
            emittedBy: this.options.budgetControl!.emittedBy,
          },
        });
      }

      return {
        tasks: parsed.tasks.map((task, index) => {
          // §40.2: Proportional budget allocation to subtasks
          const totalTaskCost = parsed.tasks.reduce((sum, t) => sum + t.estimatedCostUsd, 0);
          const taskProportion = totalTaskCost > 0 ? task.estimatedCostUsd / totalTaskCost : 1 / parsed.tasks.length;
          const goalBudgetLimit = this.options.budgetControl?.estimatedCostUsd ?? 0;
          const taskBudgetAllocation = goalBudgetLimit > 0 ? goalBudgetLimit * taskProportion : 0;

          // Derive confidence from response completeness and cost ratio
          const confidence: CostEstimate["confidence"] =
            task.estimatedCostUsd > 0 && taskProportion > 0.05 ? "medium" : "low";

          return {
            taskId: `${goal.goalId}:llm:${index + 1}`,
            domainId: task.domainId,
            description: task.description,
            inputs: {
              goalDescription: goal.description,
              successCriteria: goal.successCriteria,
              constraints: goal.constraints,
              deadline: goal.deadline ?? null,
            },
            expectedOutputs: task.expectedOutputs,
            delegationMode: task.delegationMode,
            estimatedDuration: task.estimatedDuration,
            estimatedCost: {
              estimatedCostUsd: Number(task.estimatedCostUsd.toFixed(4)),
              confidence,
              sampleCount: confidence === "medium" ? 3 : 1,
              divisionId: null,
              basedOn: "default" as const,
            },
            constraintEnvelope: {
              budgetLimitUsd: taskBudgetAllocation > 0 ? Number(taskBudgetAllocation.toFixed(4)) : null,
              ...((taskBudgetAllocation > 0) ? { budgetAllocations: [{ taskId: `${goal.goalId}:llm:${index + 1}`, budgetUsd: Number(taskBudgetAllocation.toFixed(4)), riskMultiplier: 1.0 }] } : {}),
              riskTolerance: goal.priority === "critical" ? "low" : goal.priority === "high" ? "medium" : "high",
              requiresApproval: false,
              requiredPermissions: [],
              requiredCapabilities: [],
            },
          };
        }),
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
            ...DEFAULT_BUDGET_CONTEXT,
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
    // R32-28 FIX: validate and coerce estimatedCostUsd — LLM may return non-numeric (e.g. "0.05" or malformed)
    for (const task of parsed.tasks) {
      const cost = Number(task.estimatedCostUsd);
      if (!Number.isFinite(cost)) {
        throw new Error(`goal_decomposer.invalid_task_cost:${task.description?.slice(0, 20)}`);
      }
      // Mutate in place so later toFixed() calls always succeed
      (task as { estimatedCostUsd: number }).estimatedCostUsd = cost;
    }
    return parsed;
  }

  /**
   * R5-28: Normalizes LLM output to ensure consistent format and quality.
   * Handles common LLM output issues like extra whitespace, markdown formatting,
   * and non-standard JSON structures.
   */
  private normalizeLlmOutput(rawOutput: string): string {
    // Remove leading/trailing whitespace
    let normalized = rawOutput.trim();

    // Remove markdown code blocks if present
    if (normalized.startsWith("```")) {
      normalized = normalized
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
    }

    // Remove any leading/trailing whitespace after code block removal
    normalized = normalized.trim();

    // Handle cases where LLM might wrap JSON in quotes
    if (normalized.startsWith('"') && normalized.endsWith('"')) {
      try {
        normalized = JSON.parse(normalized);
      } catch {
        // Not a quoted string, keep as-is
      }
    }

    return normalized;
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
