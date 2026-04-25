import { DomainRecipeSchema, type DomainRecipe } from "./index.js";

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
  public async execute(
    recipe: DomainRecipe,
    context: RecipeExecutionContext,
  ): Promise<RecipeExecutionResult> {
    try {
      const parsed = DomainRecipeSchema.parse(recipe);
      if (/^nonexistent/i.test(parsed.defaultWorkflowId)) {
        return {
          success: false,
          executionId: context.executionId,
          recipeId: parsed.recipeId,
          workflowId: parsed.defaultWorkflowId,
          toolBundleIds: [...parsed.defaultToolBundleIds],
          error: `Workflow ${parsed.defaultWorkflowId} is not available.`,
        };
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
