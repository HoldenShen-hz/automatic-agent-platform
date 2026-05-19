import assert from "node:assert/strict";
import test from "node:test";
import { DomainRecipeService } from "../../../src/domains/domain-recipe-service.js";
function createTestRecipe(overrides) {
    return {
        recipeId: "recipe_test",
        domainId: "coding",
        name: "Test Recipe",
        description: "Test recipe description",
        triggerPhrases: ["test", "debug"],
        defaultWorkflowId: "wf_test",
        defaultToolBundleIds: ["tools_test"],
        ...overrides,
    };
}
test("DomainRecipeService exposes 12 prototype templates", () => {
    const service = new DomainRecipeService();
    const templates = service.getPrototypeTemplates();
    assert.equal(templates.length, 12);
    assert.equal(new Set(templates.map((template) => template.templateId)).size, 12);
});
test("DomainRecipeService can create recipes from newly added prototype templates", () => {
    const service = new DomainRecipeService();
    const researchRecipe = service.createFromPrototype("knowledge-base", "prototype_research");
    const planningRecipe = service.createFromPrototype("quant-trading", "prototype_planning");
    assert.ok(researchRecipe);
    assert.equal(researchRecipe?.defaultWorkflowId, "research_workflow");
    assert.ok(planningRecipe);
    assert.equal(planningRecipe?.defaultWorkflowId, "planning_workflow");
});
test("DomainRecipeService.register stores and retrieves recipe", () => {
    const service = new DomainRecipeService();
    const recipe = createTestRecipe();
    service.register(recipe);
    const retrieved = service.getRecipe("recipe_test");
    assert.ok(retrieved);
    assert.equal(retrieved?.domainId, "coding");
    assert.deepEqual(retrieved?.triggerPhrases, ["test", "debug"]);
});
test("DomainRecipeService.getRecipe returns null for unknown recipe", () => {
    const service = new DomainRecipeService();
    const retrieved = service.getRecipe("unknown");
    assert.equal(retrieved, null);
});
test("DomainRecipeService.getRecipesByDomain filters recipes by domain", () => {
    const service = new DomainRecipeService();
    service.register(createTestRecipe({ recipeId: "r1", domainId: "coding" }));
    service.register(createTestRecipe({ recipeId: "r2", domainId: "coding" }));
    service.register(createTestRecipe({ recipeId: "r3", domainId: "data-engineering" }));
    const codingRecipes = service.getRecipesByDomain("coding");
    assert.equal(codingRecipes.length, 2);
    const dataRecipes = service.getRecipesByDomain("data-engineering");
    assert.equal(dataRecipes.length, 1);
});
test("DomainRecipeService.matchRecipe returns matching recipe", () => {
    const service = new DomainRecipeService();
    service.register(createTestRecipe({ recipeId: "r1", domainId: "coding", triggerPhrases: ["deploy"] }));
    service.register(createTestRecipe({ recipeId: "r2", domainId: "coding", triggerPhrases: ["build"] }));
    const matched = service.matchRecipe("coding", "I need to deploy this app");
    assert.ok(matched);
    assert.equal(matched?.recipeId, "r1");
});
test("DomainRecipeService.matchRecipe returns null when no match", () => {
    const service = new DomainRecipeService();
    service.register(createTestRecipe({ recipeId: "r1", domainId: "coding", triggerPhrases: ["deploy"] }));
    const matched = service.matchRecipe("coding", "I need to analyze this code");
    assert.equal(matched, null);
});
test("DomainRecipeService.matchRecipe returns null for unknown domain", () => {
    const service = new DomainRecipeService();
    service.register(createTestRecipe());
    const matched = service.matchRecipe("unknown_domain", "test input");
    assert.equal(matched, null);
});
test("DomainRecipeService.create generates new recipe with id", () => {
    const service = new DomainRecipeService();
    const recipe = service.create({
        domainId: "coding",
        name: "New Recipe",
        description: "Description",
        triggerPhrases: ["create", "new"],
        defaultWorkflowId: "wf_new",
        defaultToolBundleIds: ["tools"],
    });
    assert.ok(recipe.recipeId.startsWith("recipe_"));
    assert.equal(recipe.domainId, "coding");
    assert.equal(recipe.name, "New Recipe");
    assert.deepEqual(recipe.triggerPhrases, ["create", "new"]);
});
test("DomainRecipeService.update modifies existing recipe", () => {
    const service = new DomainRecipeService();
    service.register(createTestRecipe({ recipeId: "r_update", domainId: "coding" }));
    const updated = service.update({
        recipeId: "r_update",
        name: "Updated Name",
        triggerPhrases: ["updated"],
    });
    assert.ok(updated);
    assert.equal(updated?.name, "Updated Name");
    assert.deepEqual(updated?.triggerPhrases, ["updated"]);
});
test("DomainRecipeService.update returns null for unknown recipe", () => {
    const service = new DomainRecipeService();
    const updated = service.update({
        recipeId: "unknown",
        name: "New Name",
    });
    assert.equal(updated, null);
});
test("DomainRecipeService.update bumps version", () => {
    const service = new DomainRecipeService();
    service.register(createTestRecipe({ recipeId: "r_version", domainId: "coding" }));
    service.update({ recipeId: "r_version", name: "Version 2" });
    const history = service.getVersionHistory("r_version");
    assert.ok(history.length >= 1);
});
test("DomainRecipeService.delete removes recipe", () => {
    const service = new DomainRecipeService();
    service.register(createTestRecipe({ recipeId: "r_delete" }));
    const deleted = service.delete("r_delete");
    assert.equal(deleted, true);
    assert.equal(service.getRecipe("r_delete"), null);
});
test("DomainRecipeService.delete returns false for unknown recipe", () => {
    const service = new DomainRecipeService();
    const deleted = service.delete("unknown");
    assert.equal(deleted, false);
});
test("DomainRecipeService.getPrototypeTemplate returns template by id", () => {
    const service = new DomainRecipeService();
    const template = service.getPrototypeTemplate("prototype_analysis");
    assert.ok(template);
    assert.equal(template?.name, "Analysis Recipe");
    assert.equal(template?.category, "analysis");
});
test("DomainRecipeService.getPrototypeTemplate returns null for unknown id", () => {
    const service = new DomainRecipeService();
    const template = service.getPrototypeTemplate("unknown_template");
    assert.equal(template, null);
});
test("DomainRecipeService.createFromPrototype returns null for unknown template", () => {
    const service = new DomainRecipeService();
    const recipe = service.createFromPrototype("coding", "unknown_template");
    assert.equal(recipe, null);
});
test("DomainRecipeService.createFromPrototype applies customizations", () => {
    const service = new DomainRecipeService();
    const recipe = service.createFromPrototype("coding", "prototype_analysis", {
        name: "Custom Analysis",
        triggerPhrases: ["custom"],
    });
    assert.ok(recipe);
    assert.equal(recipe?.name, "Custom Analysis");
    assert.deepEqual(recipe?.triggerPhrases, ["custom"]);
    assert.equal(recipe?.defaultWorkflowId, "analysis_workflow"); // from prototype
});
test("DomainRecipeService.getVersionHistory returns empty array for new recipe", () => {
    const service = new DomainRecipeService();
    const history = service.getVersionHistory("new_recipe");
    assert.equal(history.length, 0);
});
test("DomainRecipeService.validate passes valid recipe", () => {
    const service = new DomainRecipeService();
    const recipe = createTestRecipe();
    const errors = service.validate(recipe);
    assert.equal(errors.length, 0);
});
test("DomainRecipeService.validate requires recipeId", () => {
    const service = new DomainRecipeService();
    const recipe = createTestRecipe({ recipeId: "" });
    const errors = service.validate(recipe);
    assert.ok(errors.some((e) => e.includes("id_required")));
});
test("DomainRecipeService.validate requires domainId", () => {
    const service = new DomainRecipeService();
    const recipe = createTestRecipe({ domainId: "" });
    const errors = service.validate(recipe);
    assert.ok(errors.some((e) => e.includes("domain_id_required")));
});
test("DomainRecipeService.validate requires defaultWorkflowId", () => {
    const service = new DomainRecipeService();
    const recipe = createTestRecipe({ defaultWorkflowId: "" });
    const errors = service.validate(recipe);
    assert.ok(errors.some((e) => e.includes("default_workflow_id_required")));
});
test("DomainRecipeService.validate requires trigger phrases", () => {
    const service = new DomainRecipeService();
    const recipe = createTestRecipe({ triggerPhrases: [] });
    const errors = service.validate(recipe);
    assert.ok(errors.some((e) => e.includes("trigger_phrases_required")));
});
test("DomainRecipeService.validate rejects short trigger phrases", () => {
    const service = new DomainRecipeService();
    const recipe = createTestRecipe({ triggerPhrases: ["a"] });
    const errors = service.validate(recipe);
    assert.ok(errors.some((e) => e.includes("trigger_phrase_too_short")));
});
test("DomainRecipeService.prototypeTemplates have correct structure", () => {
    const service = new DomainRecipeService();
    const templates = service.getPrototypeTemplates();
    for (const template of templates) {
        assert.ok(template.templateId);
        assert.ok(template.name);
        assert.ok(template.description);
        assert.ok(template.defaultWorkflowId);
        assert.ok(template.triggerPatterns.length > 0);
        assert.ok(template.category);
    }
});
test("DomainRecipeService.prototypeTemplates cover all categories", () => {
    const service = new DomainRecipeService();
    const templates = service.getPrototypeTemplates();
    const categories = new Set(templates.map((t) => t.category));
    assert.ok(categories.has("analysis"));
    assert.ok(categories.has("implementation"));
    assert.ok(categories.has("review"));
    assert.ok(categories.has("release"));
    assert.ok(categories.has("research"));
    assert.ok(categories.has("operations"));
    assert.ok(categories.has("compliance"));
    assert.ok(categories.has("support"));
    assert.ok(categories.has("creative"));
    assert.ok(categories.has("optimization"));
    assert.ok(categories.has("planning"));
    assert.ok(categories.has("general"));
});
//# sourceMappingURL=domain-recipe-service.test.js.map