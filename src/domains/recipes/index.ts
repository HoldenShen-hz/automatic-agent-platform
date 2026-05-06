import { z } from "zod";

const NonEmptyRecipeReferenceSchema = z.string().trim().min(1);

export const DomainRecipeArchetypeSchema = z.enum([
  "crud_heavy",
  "analytics",
  "creative",
  "realtime",
  "trading",
  "compliance",
  "research",
  "adversarial",
  "moderation",
  "logistics",
  "conversational",
  "incident_ops",
]);

export const DomainRecipeSchema = z.object({
  recipeId: z.string().trim().min(1),
  domainId: z.string().trim().min(1),
  archetype: DomainRecipeArchetypeSchema.default("crud_heavy"),
  name: z.string().trim().optional(),
  description: z.string().optional(),
  triggerPhrases: z.array(z.string()).default([]),
  risk_profile_ref: NonEmptyRecipeReferenceSchema,
  guardrail_overlay: NonEmptyRecipeReferenceSchema,
  recommended_workflow_ids: z.array(z.string().trim().min(1)),
  default_prompt_bundle_ref: NonEmptyRecipeReferenceSchema,
  acceptance_checklist_ref: NonEmptyRecipeReferenceSchema,
  defaultWorkflowId: z.string().trim().min(1),
  defaultToolBundleIds: z.array(z.string()).default([]),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  budgetHint: z.string().optional(),
  requiredApproval: z.boolean().default(false),
  // R17-8: Recipe version field
  version: z.string().optional(),
}).transform((recipe) => ({
  ...recipe,
  // Normalize missing or blank labels to recipeId so persisted recipes remain debuggable.
  name: recipe.name && recipe.name.length > 0 ? recipe.name : recipe.recipeId,
}));

export type DomainRecipe = z.infer<typeof DomainRecipeSchema>;
export type DomainRecipeArchetype = z.infer<typeof DomainRecipeArchetypeSchema>;

export function matchDomainRecipe(recipes: readonly DomainRecipe[], input: string): DomainRecipe | null {
  const normalized = input.toLowerCase();
  let bestMatch: {
    recipe: DomainRecipe;
    phraseLength: number;
    recipeIndex: number;
    phraseIndex: number;
  } | null = null;
  for (const [recipeIndex, item] of recipes.entries()) {
    for (const [phraseIndex, phrase] of item.triggerPhrases.entries()) {
      const lowerPhrase = phrase.toLowerCase().trim();
      if (lowerPhrase.length === 0) {
        continue;
      }
      // Match on token boundaries so short words do not spuriously match inside larger tokens.
      const regex = new RegExp(`(?:^|\\s|\\W)${lowerPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$|\\W)`, "i");
      if (!regex.test(normalized)) {
        continue;
      }
      const shouldReplace = bestMatch == null
        || lowerPhrase.length > bestMatch.phraseLength
        || (lowerPhrase.length === bestMatch.phraseLength && recipeIndex < bestMatch.recipeIndex)
        || (
          lowerPhrase.length === bestMatch.phraseLength
          && recipeIndex === bestMatch.recipeIndex
          && phraseIndex < bestMatch.phraseIndex
        );
      if (shouldReplace) {
        bestMatch = {
          recipe: item,
          phraseLength: lowerPhrase.length,
          recipeIndex,
          phraseIndex,
        };
      }
    }
  }
  return bestMatch?.recipe ?? null;
}

export { RecipeRegistry } from "./recipe-registry.js";
export {
  RecipeExecutor,
  type RecipeExecutionContext,
  type RecipeExecutionResult,
  type RecipeExecutionStartedPayload,
  type RecipeExecutionCompletedPayload,
  type RecipeExecutionMetrics,
  type RecipeExecutorOptions,
  type RecipeMetricsCollector,
} from "./recipe-executor.js";
