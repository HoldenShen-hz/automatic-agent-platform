import { DomainRecipeSchema, matchDomainRecipe, type DomainRecipe, type DomainRecipeArchetype } from "./index.js";

// R17-7: Recipe compatibility check interface
export interface RecipeCompatibilityResult {
  compatible: boolean;
  conflicts: string[];
  warnings: string[];
}

// R17-8: Recipe version info
export interface RecipeVersionInfo {
  version: string;
  minVersion: string | null;
  deprecated: boolean;
  deprecatedMessage?: string | null;
}

// R17-6: Uniqueness validation result
export interface RecipeUniquenessResult {
  unique: boolean;
  existingRecipeId?: string;
  conflictFields: string[];
}

export class RecipeRegistry {
  private readonly recipes = new Map<string, DomainRecipe>();
  private readonly versions = new Map<string, RecipeVersionInfo>();

  public register(recipe: DomainRecipe): void {
    const parsed = DomainRecipeSchema.parse(recipe);

    // R17-6: Validate recipe uniqueness
    const uniqueness = this.checkUniqueness(parsed);
    if (!uniqueness.unique) {
      throw new Error(
        `Recipe uniqueness conflict: ${parsed.recipeId} conflicts with ${uniqueness.existingRecipeId} on fields: ${uniqueness.conflictFields.join(", ")}`
      );
    }

    // R17-7: Check recipe compatibility
    const compatibility = this.checkCompatibility(parsed);
    if (!compatibility.compatible) {
      throw new Error(
        `Recipe compatibility conflict: ${parsed.recipeId} has conflicts: ${compatibility.conflicts.join(", ")}`
      );
    }

    // R17-8: Enforce recipe version if required
    if (this.versions.has(parsed.recipeId)) {
      const versionInfo = this.versions.get(parsed.recipeId)!;
      if (versionInfo.minVersion && !this.isVersionCompatible(versionInfo.minVersion, parsed.recipeId)) {
        throw new Error(
          `Recipe version incompatible: ${parsed.recipeId} version does not meet minimum version ${versionInfo.minVersion}`
        );
      }
    }

    this.recipes.set(parsed.recipeId, parsed);
  }

  public registerAll(recipes: readonly DomainRecipe[]): void {
    for (const recipe of recipes) {
      this.register(recipe);
    }
  }

  public get(recipeId: string): DomainRecipe | null {
    return this.recipes.get(recipeId) ?? null;
  }

  public list(): DomainRecipe[] {
    return [...this.recipes.values()];
  }

  public clear(): void {
    this.recipes.clear();
    this.versions.clear();
  }

  public has(recipeId: string): boolean {
    return this.recipes.has(recipeId);
  }

  public listByDomain(domainId: string): DomainRecipe[] {
    return this.list().filter((recipe) => recipe.domainId === domainId);
  }

  public findByTriggerPhrase(input: string): DomainRecipe | null {
    return matchDomainRecipe(this.list(), input);
  }

  /**
   * R17-6: Check if a recipe is unique (no duplicate recipeId or conflicting trigger phrases)
   */
  public checkUniqueness(recipe: DomainRecipe): RecipeUniquenessResult {
    const conflictFields: string[] = [];

    // Check for existing recipe with same ID
    if (this.recipes.has(recipe.recipeId)) {
      conflictFields.push("recipeId");
      return {
        unique: false,
        existingRecipeId: recipe.recipeId,
        conflictFields,
      };
    }

    // Check for recipes with overlapping trigger phrases in same domain
    for (const existing of this.recipes.values()) {
      if (existing.domainId !== recipe.domainId) {
        continue;
      }

      const overlap = this.findTriggerPhraseOverlap(existing.triggerPhrases, recipe.triggerPhrases);
      if (overlap.length > 0) {
        conflictFields.push(`triggerPhrase:${overlap.join(",")}`);
      }
    }

    return {
      unique: conflictFields.length === 0,
      conflictFields,
    };
  }

  /**
   * R17-7: Check recipe compatibility with existing recipes
   */
  public checkCompatibility(recipe: DomainRecipe): RecipeCompatibilityResult {
    const conflicts: string[] = [];
    const warnings: string[] = [];

    for (const existing of this.recipes.values()) {
      if (existing.recipeId === recipe.recipeId) {
        continue;
      }

      // Check risk level conflicts
      if (existing.domainId === recipe.domainId) {
        // High risk recipes in same domain may conflict
        if (existing.riskLevel === "critical" && recipe.riskLevel === "critical") {
          // Check if they have overlapping trigger phrases
          const overlap = this.findTriggerPhraseOverlap(existing.triggerPhrases, recipe.triggerPhrases);
          if (overlap.length > 0) {
            conflicts.push(
              `critical risk conflict: ${existing.recipeId} and ${recipe.recipeId} have overlapping triggers in same domain`
            );
          }
        }

        // R17-9: Check dependency conflicts
        if (this.hasDependencyConflict(existing, recipe)) {
          conflicts.push(`dependency conflict: ${existing.recipeId} and ${recipe.recipeId}`);
        }
      }

      // Check guardrail conflicts
      if (existing.guardrail_overlay && recipe.guardrail_overlay) {
        if (existing.guardrail_overlay !== recipe.guardrail_overlay) {
          warnings.push(
            `guardrail mismatch: ${existing.recipeId} uses ${existing.guardrail_overlay}, ${recipe.recipeId} uses ${recipe.guardrail_overlay}`
          );
        }
      }
    }

    return {
      compatible: conflicts.length === 0,
      conflicts,
      warnings,
    };
  }

  /**
   * R17-8: Set version requirements for a recipe
   */
  public setVersionRequirement(recipeId: string, minVersion: string | null): void {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe ${recipeId} not found`);
    }

    this.versions.set(recipeId, {
      version: "1.0.0", // Default version
      minVersion,
      deprecated: false,
      deprecatedMessage: null,
    });
  }

  /**
   * R17-8: Deprecate a recipe version
   */
  public deprecateVersion(recipeId: string, message?: string): void {
    const versionInfo = this.versions.get(recipeId);
    if (versionInfo) {
      versionInfo.deprecated = true;
      versionInfo.deprecatedMessage = message ?? null;
    } else {
      this.versions.set(recipeId, {
        version: "1.0.0",
        minVersion: null,
        deprecated: true,
        deprecatedMessage: message ?? null,
      });
    }
  }

  /**
   * R17-8: Get version info for a recipe
   */
  public getVersionInfo(recipeId: string): RecipeVersionInfo | null {
    return this.versions.get(recipeId) ?? null;
  }

  /**
   * R17-9: Resolve recipe dependencies
   */
  public resolveDependencies(recipeId: string): { resolved: boolean; missing: string[] } {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      return { resolved: false, missing: [recipeId] };
    }

    const missing: string[] = [];

    // Check if required workflows exist
    if (recipe.recommended_workflow_ids) {
      for (const wfId of recipe.recommended_workflow_ids) {
        // In production, would check workflow registry
        // For now, just verify the workflow ID format
        if (!wfId || wfId.trim().length === 0) {
          missing.push(wfId);
        }
      }
    }

    // R17-9: Additional dependency resolution would check:
    // - Required tool bundles
    // - Dependent recipes
    // - External service dependencies

    return {
      resolved: missing.length === 0,
      missing,
    };
  }

  /**
   * R17-7: Check for dependency conflicts between two recipes
   */
  private hasDependencyConflict(a: DomainRecipe, b: DomainRecipe): boolean {
    // Check if they recommend conflicting workflows
    const aWorkflows = new Set(a.recommended_workflow_ids ?? []);
    const bWorkflows = new Set(b.recommended_workflow_ids ?? []);

    for (const wf of aWorkflows) {
      if (bWorkflows.has(wf)) {
        return true;
      }
    }

    return false;
  }

  /**
   * R17-6: Find overlapping trigger phrases
   */
  private findTriggerPhraseOverlap(a: readonly string[], b: readonly string[]): string[] {
    const overlap: string[] = [];
    const normalizedA = a.map((p) => p.toLowerCase().trim());
    const normalizedB = b.map((p) => p.toLowerCase().trim());

    for (const phraseA of normalizedA) {
      for (const phraseB of normalizedB) {
        if (phraseA === phraseB || phraseA.includes(phraseB) || phraseB.includes(phraseA)) {
          overlap.push(phraseA);
        }
      }
    }

    return [...new Set(overlap)];
  }

  /**
   * R17-8: Check if version is compatible with minimum version requirement
   */
  private isVersionCompatible(minVersion: string, recipeId: string): boolean {
    // Simple version comparison - in production use semver library
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      return false;
    }

    // Extract version from recipe if it exists, default to 1.0.0
    const currentVersion = (recipe as DomainRecipe & { version?: string }).version ?? "1.0.0";
    return this.compareVersions(currentVersion, minVersion) >= 0;
  }

  /**
   * R17-8: Compare two version strings
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] ?? 0;
      const numB = partsB[i] ?? 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }

    return 0;
  }
}