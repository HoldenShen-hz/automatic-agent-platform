import { DomainRecipeSchema, type DomainRecipe } from "./index.js";
import type { WorkflowRegistry } from "../registry/workflow-registry.js";

export interface RecipeExecutionContext {
  executionId: string;
  taskId: string;
  tenantId: string;
  correlationId: string;
  input: string;
}

export interface RecipeExecutionResult {
  success: boolean;
  executionId: string;
  recipeId: string;
  workflowId: string;
  toolBundleIds: string[];
  output?: {
    summary: string;
    taskId: string;
    tenantId: string;
    correlationId: string;
    input: string;
  };
  error?: string;
}

export interface RecipeExecutionMetrics {
  executionId: string;
  recipeId: string;
  workflowId: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface RecipeMetricsCollector {
  recordExecution(metrics: RecipeExecutionMetrics): void;
}

export interface RecipeExecutorOptions {
  metricsCollector?: RecipeMetricsCollector;
}

export class RecipeExecutor {
  public constructor(
    private readonly workflowRegistry: WorkflowRegistry | null = null,
    private readonly options: RecipeExecutorOptions = {},
  ) {}

  public async execute(
    recipe: DomainRecipe,
    context: RecipeExecutionContext,
  ): Promise<RecipeExecutionResult> {
    const startedAt = Date.now();
    let metrics: RecipeExecutionMetrics | null = null;
    try {
      const parsed = DomainRecipeSchema.parse(recipe);
      if (!this.workflowExists(parsed.defaultWorkflowId)) {
        const result = {
          success: false,
          executionId: context.executionId,
          recipeId: parsed.recipeId,
          workflowId: parsed.defaultWorkflowId,
          toolBundleIds: [...parsed.defaultToolBundleIds],
          error: `Workflow ${parsed.defaultWorkflowId} is not available.`,
        };
        metrics = {
          executionId: context.executionId,
          recipeId: parsed.recipeId,
          workflowId: parsed.defaultWorkflowId,
          success: false,
          durationMs: Date.now() - startedAt,
          error: result.error,
        };
        return result;
      }

      const result = {
        success: true,
        executionId: context.executionId,
        recipeId: parsed.recipeId,
        workflowId: parsed.defaultWorkflowId,
        toolBundleIds: [...parsed.defaultToolBundleIds],
        output: {
          summary: `Executed recipe ${parsed.recipeId} for workflow ${parsed.defaultWorkflowId}.`,
          taskId: context.taskId,
          tenantId: context.tenantId,
          correlationId: context.correlationId,
          input: context.input,
        },
      };
      metrics = {
        executionId: context.executionId,
        recipeId: parsed.recipeId,
        workflowId: parsed.defaultWorkflowId,
        success: true,
        durationMs: Date.now() - startedAt,
      };
      return result;
    } catch (error) {
      const result = {
        success: false,
        executionId: context.executionId,
        recipeId: recipe?.recipeId ?? "unknown_recipe",
        workflowId: recipe?.defaultWorkflowId ?? "unknown_workflow",
        toolBundleIds: Array.isArray(recipe?.defaultToolBundleIds) ? [...recipe.defaultToolBundleIds] : [],
        error: error instanceof Error ? error.message : String(error),
      };
      metrics = {
        executionId: context.executionId,
        recipeId: result.recipeId,
        workflowId: result.workflowId,
        success: false,
        durationMs: Date.now() - startedAt,
        error: result.error,
      };
      return result;
    } finally {
      if (metrics != null) {
        this.options.metricsCollector?.recordExecution(metrics);
      }
    }
  }

  private workflowExists(workflowId: string): boolean {
    return this.workflowRegistry?.get(workflowId) != null;
  }
}
