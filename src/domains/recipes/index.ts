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
  riskProfileRef: z.string().min(1),
  guardrailOverlay: z.record(z.string(), z.unknown()).default({}),
  triggerPhrases: z.array(z.string()).default([]),
  defaultWorkflowId: z.string().min(1),
  recommendedWorkflowIds: z.array(z.string().min(1)).default([]),
  defaultToolBundleIds: z.array(z.string()).default([]),
  defaultPromptBundleRef: z.string().min(1),
  acceptanceChecklistRef: z.string().min(1),
});

export type DomainRecipe = z.infer<typeof DomainRecipeSchema>;
export type DomainRecipeArchetype = z.infer<typeof DomainRecipeArchetypeSchema>;

export function matchDomainRecipe(recipes: readonly DomainRecipe[], input: string): DomainRecipe | null {
  const normalized = input.toLowerCase();
  return recipes.find((item) => item.triggerPhrases.some((phrase) => normalized.includes(phrase.toLowerCase()))) ?? null;
}

export { RecipeRegistry } from "./recipe-registry.js";
export { RecipeExecutor, type RecipeExecutionContext, type RecipeExecutionResult } from "./recipe-executor.js";
