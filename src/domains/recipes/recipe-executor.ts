import { DomainRecipeSchema, type DomainRecipe } from "./index.js";
import type { WorkflowRegistry } from "../registry/workflow-registry.js";
import { getWorkflowDefinition } from "../../platform/five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";

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

export interface WorkflowQuery {
  existsWorkflow(
    workflowId: string,
    tenantId?: string | null,
  ): Promise<boolean> | boolean;
}

export class RecipeExecutor {
  public constructor(
    private readonly workflowRegistry: WorkflowRegistry | null = null,
    private readonly options: RecipeExecutorOptions = {},
    private readonly workflowQuery?: WorkflowQuery | null,
  ) {}

  public async execute(
    recipe: DomainRecipe,
    context: RecipeExecutionContext,
  ): Promise<RecipeExecutionResult> {
    const startedAt = Date.now();
    let metrics: RecipeExecutionMetrics | null = null;
    let parsedRecipe: DomainRecipe | null = null;
    try {
      parsedRecipe = DomainRecipeSchema.parse(recipe);
      if (!(await this.workflowExists(parsedRecipe.defaultWorkflowId))) {
        const result = {
          success: false,
          executionId: context.executionId,
          recipeId: parsedRecipe.recipeId,
          workflowId: parsedRecipe.defaultWorkflowId,
          toolBundleIds: [...parsedRecipe.defaultToolBundleIds],
          error: `Workflow ${parsedRecipe.defaultWorkflowId} is not available.`,
        };
        metrics = {
          executionId: context.executionId,
          recipeId: parsedRecipe.recipeId,
          workflowId: parsedRecipe.defaultWorkflowId,
          success: false,
          durationMs: Date.now() - startedAt,
          error: result.error,
        };
        return result;
      }

      const result = {
        success: true,
        executionId: context.executionId,
        recipeId: parsedRecipe.recipeId,
        workflowId: parsedRecipe.defaultWorkflowId,
        toolBundleIds: [...parsedRecipe.defaultToolBundleIds],
        output: {
          summary: `Executed recipe ${parsedRecipe.recipeId} for workflow ${parsedRecipe.defaultWorkflowId}.`,
          taskId: context.taskId,
          tenantId: context.tenantId,
          correlationId: context.correlationId,
          input: context.input,
        },
      };
      metrics = {
        executionId: context.executionId,
        recipeId: parsedRecipe.recipeId,
        workflowId: parsedRecipe.defaultWorkflowId,
        success: true,
        durationMs: Date.now() - startedAt,
      };
      return result;
    } catch (error) {
      const result = {
        success: false,
        executionId: context.executionId,
        recipeId: parsedRecipe?.recipeId ?? "unknown_recipe",
        workflowId:
          parsedRecipe?.defaultWorkflowId ??
          recipe?.defaultWorkflowId ??
          "unknown_workflow",
        toolBundleIds: Array.isArray(parsedRecipe?.defaultToolBundleIds)
          ? [...parsedRecipe.defaultToolBundleIds]
          : Array.isArray(recipe?.defaultToolBundleIds)
            ? [...recipe.defaultToolBundleIds]
            : [],
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

  private async workflowExists(
    workflowId: string,
    tenantId?: string | null,
  ): Promise<boolean> {
    if (this.workflowQuery) {
      const result = this.workflowQuery.existsWorkflow(workflowId, tenantId);
      // Unwrap promised boolean or plain boolean
      if (typeof result === "boolean" ? result : await result) {
        return true;
      }
    }
    // Fallback: in-memory registry lookup
    return this.workflowRegistry?.get(workflowId) != null;
  }
}
