/**
 * Domain Recipe Service
 *
 * Handles recipe management including:
 * - CRUD operations for recipes
 * - Recipe matching based on trigger phrases
 * - Prototype template validation
 * - Recipe versioning
 *
 * As defined in architecture doc §37.6 DomainRecipe.
 */
import { type DomainRecipe } from "./recipes/index.js";
export interface RecipeTemplate {
    readonly templateId: string;
    readonly name: string;
    readonly description: string;
    readonly category: "analysis" | "implementation" | "review" | "release" | "research" | "operations" | "compliance" | "support" | "creative" | "optimization" | "planning" | "general";
    readonly triggerPatterns: readonly string[];
    readonly defaultWorkflowId: string;
    readonly defaultToolBundleIds: readonly string[];
    readonly estimatedDurationMinutes?: number;
}
export interface RecipeVersion {
    readonly versionId: string;
    readonly recipeId: string;
    readonly version: string;
    readonly changelog: string;
    readonly createdAt: string;
}
export interface RecipeCreateRequest {
    readonly domainId: string;
    readonly name: string;
    readonly description: string;
    readonly triggerPhrases: readonly string[];
    readonly defaultWorkflowId: string;
    readonly defaultToolBundleIds?: readonly string[];
}
export interface RecipeUpdateRequest {
    readonly recipeId: string;
    readonly name?: string;
    readonly description?: string;
    readonly triggerPhrases?: readonly string[];
    readonly defaultWorkflowId?: string;
    readonly defaultToolBundleIds?: readonly string[];
}
export declare class DomainRecipeService {
    private readonly recipes;
    private readonly versions;
    private readonly prototypeTemplates;
    register(recipe: DomainRecipe): void;
    getRecipe(recipeId: string): DomainRecipe | null;
    getRecipesByDomain(domainId: string): readonly DomainRecipe[];
    matchRecipe(domainId: string, input: string): DomainRecipe | null;
    create(request: RecipeCreateRequest): DomainRecipe;
    update(request: RecipeUpdateRequest): DomainRecipe | null;
    delete(recipeId: string): boolean;
    getPrototypeTemplates(): readonly RecipeTemplate[];
    getPrototypeTemplate(templateId: string): RecipeTemplate | null;
    createFromPrototype(domainId: string, templateId: string, customizations?: Partial<RecipeCreateRequest>): DomainRecipe | null;
    getVersionHistory(recipeId: string): readonly RecipeVersion[];
    validate(recipe: DomainRecipe): readonly string[];
    private initializeVersionHistory;
    private recordVersion;
    private getLatestVersion;
    private bumpVersion;
}
