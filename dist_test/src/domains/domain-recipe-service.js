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
import { matchDomainRecipe } from "./recipes/index.js";
export class DomainRecipeService {
    recipes = new Map();
    versions = new Map();
    // §37.6 Prototype templates - 4 canonical recipe templates
    prototypeTemplates = [
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
    register(recipe) {
        this.recipes.set(recipe.recipeId, recipe);
        this.initializeVersionHistory(recipe.recipeId);
    }
    getRecipe(recipeId) {
        return this.recipes.get(recipeId) ?? null;
    }
    getRecipesByDomain(domainId) {
        const results = [];
        for (const recipe of this.recipes.values()) {
            if (recipe.domainId === domainId) {
                results.push(recipe);
            }
        }
        return results;
    }
    matchRecipe(domainId, input) {
        const domainRecipes = this.getRecipesByDomain(domainId);
        return matchDomainRecipe(domainRecipes, input);
    }
    create(request) {
        const recipe = {
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
    update(request) {
        const existing = this.recipes.get(request.recipeId);
        if (!existing) {
            return null;
        }
        const previousVersion = this.getLatestVersion(request.recipeId);
        const newVersion = previousVersion
            ? this.bumpVersion(previousVersion.version)
            : "1.0.0";
        const updated = {
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
    delete(recipeId) {
        const existed = this.recipes.has(recipeId);
        if (existed) {
            this.recipes.delete(recipeId);
            this.versions.delete(recipeId);
        }
        return existed;
    }
    getPrototypeTemplates() {
        return [...this.prototypeTemplates];
    }
    getPrototypeTemplate(templateId) {
        return this.prototypeTemplates.find((t) => t.templateId === templateId) ?? null;
    }
    createFromPrototype(domainId, templateId, customizations) {
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
    getVersionHistory(recipeId) {
        return this.versions.get(recipeId) ?? [];
    }
    validate(recipe) {
        const errors = [];
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
    initializeVersionHistory(recipeId) {
        if (!this.versions.has(recipeId)) {
            this.versions.set(recipeId, []);
        }
    }
    recordVersion(recipeId, version, changelog) {
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
    getLatestVersion(recipeId) {
        const versions = this.versions.get(recipeId) ?? [];
        if (versions.length === 0) {
            return null;
        }
        const sorted = [...versions].sort((a, b) => b.version.localeCompare(a.version));
        return sorted[0] ?? null;
    }
    bumpVersion(version) {
        const parts = version.split(".");
        const major = Number.parseInt(parts[0] ?? "1", 10);
        const minor = Number.parseInt(parts[1] ?? "0", 10);
        return `${major}.${minor + 1}`;
    }
}
//# sourceMappingURL=domain-recipe-service.js.map