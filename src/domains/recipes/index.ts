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
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  triggerPhrases: z.array(z.string()).default([]),
  defaultWorkflowId: z.string().min(1),
  defaultToolBundleIds: z.array(z.string()).default([]),
});

export type DomainRecipe = z.infer<typeof DomainRecipeSchema>;
export type DomainRecipeArchetype = z.infer<typeof DomainRecipeArchetypeSchema>;

export function matchDomainRecipe(recipes: readonly DomainRecipe[], input: string): DomainRecipe | null {
  const normalized = input.toLowerCase();
  return recipes.find((item) => item.triggerPhrases.some((phrase) => normalized.includes(phrase.toLowerCase()))) ?? null;
}

export { RecipeRegistry } from "./recipe-registry.js";
export { RecipeExecutor, type RecipeExecutionContext, type RecipeExecutionResult } from "./recipe-executor.js";
