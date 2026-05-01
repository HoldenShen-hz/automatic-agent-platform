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
  recipeId: z.string().min(1),
  domainId: z.string().min(1),
  archetype: DomainRecipeArchetypeSchema.default("crud_heavy"),
  name: z.string().min(1),
  description: z.string().optional(),
  triggerPhrases: z.array(z.string()).default([]),
  risk_profile_ref: z.string().min(1),
  guardrail_overlay: z.string().min(1),
  recommended_workflow_ids: z.array(z.string()).default([]),
  default_prompt_bundle_ref: z.string().min(1),
  acceptance_checklist_ref: z.string().min(1),
  defaultWorkflowId: z.string().min(1),
  defaultToolBundleIds: z.array(z.string()).default([]),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  budgetHint: z.string().optional(),
  requiredApproval: z.boolean().default(false),
});

export type DomainRecipe = z.infer<typeof DomainRecipeSchema>;
export type DomainRecipeArchetype = z.infer<typeof DomainRecipeArchetypeSchema>;

export function matchDomainRecipe(recipes: readonly DomainRecipe[], input: string): DomainRecipe | null {
  const normalized = input.toLowerCase();
  // Use word-boundary matching to prevent short phrases from matching inside longer ones.
  // Sort by length descending so longer phrases take priority over shorter ones.
  const sorted = [...recipes].sort((a, b) => b.triggerPhrases[0]?.length - a.triggerPhrases[0]?.length);
  for (const item of sorted) {
    for (const phrase of item.triggerPhrases) {
      const lowerPhrase = phrase.toLowerCase();
      // Match at word boundary: phrase must appear at start, after whitespace, or preceded by non-word char
      const regex = new RegExp(`(?:^|\\s|\\W)${lowerPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$|\\W)`, "i");
      if (regex.test(normalized)) {
        return item;
      }
    }
  }
  return null;
}

export { RecipeRegistry } from "./recipe-registry.js";
export { RecipeExecutor, type RecipeExecutionContext, type RecipeExecutionResult } from "./recipe-executor.js";
