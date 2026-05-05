import { z } from "zod";

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
  risk_profile_ref: z.string().default(""),
  guardrail_overlay: z.string().default(""),
  recommended_workflow_ids: z.array(z.string()).default([]),
  default_prompt_bundle_ref: z.string().default(""),
  acceptance_checklist_ref: z.string().default(""),
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
  // §2313: Sort by trigger phrase length descending so longer phrases take priority.
  // This prevents short phrases from matching as substrings inside longer ones.
  const sorted = [...recipes].sort((a, b) => {
    const aLen = a.triggerPhrases[0]?.length ?? 0;
    const bLen = b.triggerPhrases[0]?.length ?? 0;
    return bLen - aLen;
  });
  for (const item of sorted) {
    for (const phrase of item.triggerPhrases) {
      const lowerPhrase = phrase.toLowerCase();
      // Word-boundary matching: phrase must appear at word boundary to prevent substring matches
      // that would cause "an" to match inside "plan"
      const regex = new RegExp(`(?:^|\\s|\\W)${lowerPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$|\\W)`, "i");
      if (regex.test(normalized)) {
        return item;
      }
    }
  }
  return null;
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
