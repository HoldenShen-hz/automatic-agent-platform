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

import { newId, nowIso } from "../platform/contracts/types/ids.js";
import { type DomainRecipe, matchDomainRecipe } from "./recipes/index.js";

export interface RecipeTemplate {
  readonly templateId: string;
  readonly name: string;
  readonly description: string;
  readonly category: "analysis" | "implementation" | "review" | "release" | "general";
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

export class DomainRecipeService {
  private readonly recipes = new Map<string, DomainRecipe>();
  private readonly versions = new Map<string, RecipeVersion[]>();

  // §37.6 Prototype templates - 4 canonical recipe templates
  private readonly prototypeTemplates: readonly RecipeTemplate[] = [
    {
      templateId: "prototype_analysis",
      name: "Analysis Recipe",
      description: "Template for analysis-type tasks requiring data examination and insights",
      category: "analysis",
      triggerPatterns: ["analyze", "examine", "investigate", "review data", "assess"],
      defaultWorkflowId: "analysis_workflow",
      defaultToolBundleIds: ["data_tools", "visualization_tools"],
      estimatedDurationMinutes: 30,
    },
    {
      templateId: "prototype_implementation",
      name: "Implementation Recipe",
      description: "Template for implementation tasks requiring code generation and testing",
      category: "implementation",
      triggerPatterns: ["implement", "create", "build", "generate", "develop"],
      defaultWorkflowId: "implementation_workflow",
      defaultToolBundleIds: ["code_tools", "testing_tools"],
      estimatedDurationMinutes: 120,
    },
    {
      templateId: "prototype_review",
      name: "Review Recipe",
      description: "Template for review tasks requiring validation and feedback",
      category: "review",
      triggerPatterns: ["review", "check", "validate", "verify", "audit"],
      defaultWorkflowId: "review_workflow",
      defaultToolBundleIds: ["review_tools", "reporting_tools"],
      estimatedDurationMinutes: 45,
    },
    {
      templateId: "prototype_release",
      name: "Release Recipe",
      description: "Template for release tasks requiring deployment and monitoring",
      category: "release",
      triggerPatterns: ["release", "deploy", "publish", "ship", "launch"],
      defaultWorkflowId: "release_workflow",
      defaultToolBundleIds: ["deployment_tools", "monitoring_tools"],
      estimatedDurationMinutes: 60,
    },
  ];

  public register(recipe: DomainRecipe): void {
    this.recipes.set(recipe.recipeId, recipe);
    this.initializeVersionHistory(recipe.recipeId);
  }

  public getRecipe(recipeId: string): DomainRecipe | null {
    return this.recipes.get(recipeId) ?? null;
  }

  public getRecipesByDomain(domainId: string): readonly DomainRecipe[] {
    const results: DomainRecipe[] = [];
    for (const recipe of this.recipes.values()) {
      if (recipe.domainId === domainId) {
        results.push(recipe);
      }
    }
    return results;
  }

  public matchRecipe(domainId: string, input: string): DomainRecipe | null {
    const domainRecipes = this.getRecipesByDomain(domainId);
    return matchDomainRecipe(domainRecipes, input);
  }

  public create(request: RecipeCreateRequest): DomainRecipe {
    const recipe: DomainRecipe = {
      recipeId: newId("recipe"),
      domainId: request.domainId,
      name: request.name,
      description: request.description,
      triggerPhrases: [...request.triggerPhrases],
      defaultWorkflowId: request.defaultWorkflowId,
      defaultToolBundleIds: [...(request.defaultToolBundleIds ?? [])],
    };

    this.recipes.set(recipe.recipeId, recipe);
    this.initializeVersionHistory(recipe.recipeId);
    this.recordVersion(recipe.recipeId, "1.0.0", "Initial creation");

    return recipe;
  }

  public update(request: RecipeUpdateRequest): DomainRecipe | null {
    const existing = this.recipes.get(request.recipeId);
    if (!existing) {
      return null;
    }

    const previousVersion = this.getLatestVersion(request.recipeId);
    const newVersion = previousVersion
      ? this.bumpVersion(previousVersion.version)
      : "1.0.0";

    const updated: DomainRecipe = {
      ...existing,
      name: request.name ?? existing.name,
      description: request.description ?? existing.description,
      triggerPhrases: request.triggerPhrases ? [...request.triggerPhrases] : (existing.triggerPhrases ?? []),
      defaultWorkflowId: request.defaultWorkflowId ?? existing.defaultWorkflowId,
      defaultToolBundleIds: request.defaultToolBundleIds ? [...request.defaultToolBundleIds] : (existing.defaultToolBundleIds ?? []),
    };

    this.recipes.set(request.recipeId, updated);
    this.recordVersion(request.recipeId, newVersion, `Updated: ${Object.keys(request).join(", ")}`);

    return updated;
  }

  public delete(recipeId: string): boolean {
    const existed = this.recipes.has(recipeId);
    if (existed) {
      this.recipes.delete(recipeId);
      this.versions.delete(recipeId);
    }
    return existed;
  }

  public getPrototypeTemplates(): readonly RecipeTemplate[] {
    return [...this.prototypeTemplates];
  }

  public getPrototypeTemplate(templateId: string): RecipeTemplate | null {
    return this.prototypeTemplates.find((t) => t.templateId === templateId) ?? null;
  }

  public createFromPrototype(
    domainId: string,
    templateId: string,
    customizations?: Partial<RecipeCreateRequest>,
  ): DomainRecipe | null {
    const template = this.getPrototypeTemplate(templateId);
    if (!template) {
      return null;
    }

    return this.create({
      domainId,
      name: customizations?.name ?? template.name,
      description: customizations?.description ?? template.description,
      triggerPhrases: customizations?.triggerPhrases ?? template.triggerPatterns,
      defaultWorkflowId: customizations?.defaultWorkflowId ?? template.defaultWorkflowId,
      defaultToolBundleIds: customizations?.defaultToolBundleIds ?? template.defaultToolBundleIds,
    });
  }

  public getVersionHistory(recipeId: string): readonly RecipeVersion[] {
    return this.versions.get(recipeId) ?? [];
  }

  public validate(recipe: DomainRecipe): readonly string[] {
    const errors: string[] = [];

    if (!recipe.recipeId || recipe.recipeId.trim().length === 0) {
      errors.push("recipe.id_required");
    }

    if (!recipe.domainId || recipe.domainId.trim().length === 0) {
      errors.push("recipe.domain_id_required");
    }

    if (!recipe.defaultWorkflowId || recipe.defaultWorkflowId.trim().length === 0) {
      errors.push("recipe.default_workflow_id_required");
    }

    if (recipe.triggerPhrases.length === 0) {
      errors.push("recipe.trigger_phrases_required");
    }

    for (const phrase of recipe.triggerPhrases) {
      if (phrase.trim().length < 2) {
        errors.push(`recipe.trigger_phrase_too_short:${phrase}`);
      }
    }

    return errors;
  }

  private initializeVersionHistory(recipeId: string): void {
    if (!this.versions.has(recipeId)) {
      this.versions.set(recipeId, []);
    }
  }

  private recordVersion(recipeId: string, version: string, changelog: string): void {
    const versions = this.versions.get(recipeId) ?? [];
    versions.push({
      versionId: newId("recipe_version"),
      recipeId,
      version,
      changelog,
      createdAt: nowIso(),
    });
    this.versions.set(recipeId, versions);
  }

  private getLatestVersion(recipeId: string): RecipeVersion | null {
    const versions = this.versions.get(recipeId) ?? [];
    if (versions.length === 0) {
      return null;
    }
    const sorted = [...versions].sort((a, b) => b.version.localeCompare(a.version));
    return sorted[0] ?? null;
  }

  private bumpVersion(version: string): string {
    const parts = version.split(".");
    const major = Number.parseInt(parts[0] ?? "1", 10);
    const minor = Number.parseInt(parts[1] ?? "0", 10);
    return `${major}.${minor + 1}`;
  }
}
