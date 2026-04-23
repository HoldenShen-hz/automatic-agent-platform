import type { UnifiedChatProvider } from "../../platform/model-gateway/provider-registry/index.js";
import type { Goal, PlannedTask, TaskDependency } from "./index.js";

export interface LlmPlan {
  readonly tasks: readonly PlannedTask[];
  readonly dependencyGraph: readonly TaskDependency[];
}

export interface LlmPlanGenerator {
  generate(goal: Goal): Promise<LlmPlan>;
}

export interface UnifiedChatPlanGeneratorOptions {
  readonly provider: UnifiedChatProvider;
  readonly model?: string;
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

  public constructor(private readonly options: UnifiedChatPlanGeneratorOptions) {
    this.model = options.model ?? "gpt-4o-mini";
  }

  public async generate(goal: Goal): Promise<LlmPlan> {
    const response = await this.options.provider.complete(this.buildPrompt(goal), {
      model: this.model,
      system:
        "You are a goal decomposition planner. Return strict JSON only with tasks and dependencyGraph. No markdown.",
      temperature: 0.1,
      maxTokens: 1200,
    });

    const parsed = this.parsePlan(response);
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
        },
        expectedOutputs: task.expectedOutputs,
        delegationMode: task.delegationMode,
        estimatedDuration: task.estimatedDuration,
        estimatedCost: {
          estimatedCostUsd: Number(task.estimatedCostUsd.toFixed(4)),
          confidence: "low",
          sampleCount: 0,
          divisionId: null,
          basedOn: "default",
        },
      })),
      dependencyGraph: parsed.dependencyGraph.map((edge) => ({
        ...edge,
        fromTask: this.normalizeTaskReference(goal.goalId, edge.fromTask),
        toTask: this.normalizeTaskReference(goal.goalId, edge.toTask),
      })),
    };
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
