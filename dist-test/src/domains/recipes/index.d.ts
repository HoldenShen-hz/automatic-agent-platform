import { z } from "zod";
export declare const DomainRecipeSchema: z.ZodObject<{
    recipeId: z.ZodString;
    domainId: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    triggerPhrases: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    defaultWorkflowId: z.ZodString;
    defaultToolBundleIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    domainId: string;
    defaultToolBundleIds: string[];
    recipeId: string;
    triggerPhrases: string[];
    defaultWorkflowId: string;
    name?: string | undefined;
    description?: string | undefined;
}, {
    domainId: string;
    recipeId: string;
    defaultWorkflowId: string;
    name?: string | undefined;
    defaultToolBundleIds?: string[] | undefined;
    description?: string | undefined;
    triggerPhrases?: string[] | undefined;
}>;
export type DomainRecipe = z.infer<typeof DomainRecipeSchema>;
export declare function matchDomainRecipe(recipes: readonly DomainRecipe[], input: string): DomainRecipe | null;
