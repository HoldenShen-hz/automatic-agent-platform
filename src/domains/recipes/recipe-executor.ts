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

export class RecipeExecutor {
  private readonly workflowRegistry: WorkflowRegistry | null;

  public constructor(workflowRegistry?: WorkflowRegistry) {
    this.workflowRegistry = workflowRegistry ?? null;
  }

  public async execute(
    recipe: DomainRecipe,
    context: RecipeExecutionContext,
  ): Promise<RecipeExecutionResult> {
    try {
      const parsed = DomainRecipeSchema.parse(recipe);
      // R16-04 FIX: When registry is null, we cannot verify workflow existence.
      // Only succeed if registry is null (backward compat) OR workflow exists.
      const workflow = this.workflowRegistry
        ? this.workflowRegistry.get(parsed.defaultWorkflowId)
        : null;
      if (this.workflowRegistry && workflow == null) {
        // Registry exists but workflow not found — fail
        return {
          success: false,
          executionId: context.executionId,
          recipeId: parsed.recipeId,
          workflowId: parsed.defaultWorkflowId,
          toolBundleIds: [...parsed.defaultToolBundleIds],
          error: `Workflow ${parsed.defaultWorkflowId} is not available in the registry.`,
        };
      }
      if (!this.workflowRegistry) {
        // R16-04 FIX: registry is null — warn but allow execution to proceed
        // (legacy fallback mode; workflow existence cannot be verified)
        console.warn(`RecipeExecutor: workflow registry not available, skipping workflow verification for ${parsed.defaultWorkflowId}`);
      }

      return {
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
    } catch (error) {
      return {
        success: false,
        executionId: context.executionId,
        recipeId: recipe?.recipeId ?? "unknown_recipe",
        workflowId: recipe?.defaultWorkflowId ?? "unknown_workflow",
        toolBundleIds: Array.isArray(recipe?.defaultToolBundleIds) ? [...recipe.defaultToolBundleIds] : [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
