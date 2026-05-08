import assert from "node:assert/strict";
import test from "node:test";

import { DomainRecipeService, type RecipeCreateRequest, type RecipeUpdateRequest } from "../../src/domains/domain-recipe-service.js";
import { type DomainRecipe, type DomainRecipeArchetype } from "../../src/domains/recipes/index.js";

function createTestRecipe(overrides?: Partial<DomainRecipe>): DomainRecipe {
  return {
    recipeId: "test-recipe-001",
    domainId: "test-domain",
    archetype: "crud_heavy" as DomainRecipeArchetype,
    name: "Test Recipe",
    description: "A test recipe for unit testing",
    triggerPhrases: ["test", "example"],
    defaultWorkflowId: "test_workflow",
    defaultToolBundleIds: ["test_tools"],
    riskLevel: "medium",
    risk_profile_ref: "test-domain.risk",
    guardrail_overlay: "test-domain.guardrails",
    recommended_workflow_ids: ["test_workflow"],
    default_prompt_bundle_ref: "test-domain.prompts",
    acceptance_checklist_ref: "test-domain.acceptance",
    requiredApproval: false,
    ...overrides,
  };
}

test("DomainRecipeService registers and retrieves a recipe", () => {
  const service = new DomainRecipeService();
  const recipe = createTestRecipe();

  service.register(recipe);
  const retrieved = service.getRecipe("test-recipe-001");

  assert.ok(retrieved != null, "retrieved recipe should not be null");
  assert.equal(retrieved.recipeId, "test-recipe-001");
  assert.equal(retrieved.domainId, "test-domain");
  assert.equal(retrieved.name, "Test Recipe");
});

test("DomainRecipeService returns null for non-existent recipe", () => {
  const service = new DomainRecipeService();

  const result = service.getRecipe("non-existent-id");

  assert.strictEqual(result, null);
});

test("DomainRecipeService.getRecipesByDomain returns only recipes for specified domain", () => {
  const service = new DomainRecipeService();

  service.register(createTestRecipe({ recipeId: "r1", domainId: "domain-a" }));
  service.register(createTestRecipe({ recipeId: "r2", domainId: "domain-b" }));
  service.register(createTestRecipe({ recipeId: "r3", domainId: "domain-a" }));

  const domainAResults = service.getRecipesByDomain("domain-a");
  const domainBResults = service.getRecipesByDomain("domain-b");
  const domainCResults = service.getRecipesByDomain("domain-c");

  assert.equal(domainAResults.length, 2);
  assert.equal(domainBResults.length, 1);
  assert.equal(domainCResults.length, 0);
});

test("DomainRecipeService.matchRecipe returns matching recipe for input", () => {
  const service = new DomainRecipeService();

  service.register(createTestRecipe({
    recipeId: "analyze-recipe",
    domainId: "test-domain",
    triggerPhrases: ["analyze", "examine"],
  }));

  const result = service.matchRecipe("test-domain", "Please analyze the data");

  assert.ok(result != null);
  assert.equal(result.recipeId, "analyze-recipe");
});

test("DomainRecipeService.matchRecipe returns null when no match found", () => {
  const service = new DomainRecipeService();

  service.register(createTestRecipe({
    recipeId: "analyze-recipe",
    domainId: "test-domain",
    triggerPhrases: ["analyze", "examine"],
  }));

  const result = service.matchRecipe("test-domain", "This has no matching phrases");

  assert.strictEqual(result, null);
});

test("DomainRecipeService.matchRecipe returns null for different domain", () => {
  const service = new DomainRecipeService();

  service.register(createTestRecipe({
    recipeId: "analyze-recipe",
    domainId: "domain-a",
    triggerPhrases: ["analyze"],
  }));

  const result = service.matchRecipe("domain-b", "analyze something");

  assert.strictEqual(result, null);
});

test("DomainRecipeService.create creates a new recipe with generated ID", () => {
  const service = new DomainRecipeService();

  const request: RecipeCreateRequest = {
    domainId: "new-domain",
    name: "New Recipe",
    description: "A newly created recipe",
    triggerPhrases: ["create", "new"],
    defaultWorkflowId: "new_workflow",
    defaultToolBundleIds: ["tool1", "tool2"],
  };

  const result = service.create(request);

  assert.ok(result.recipeId.startsWith("recipe_"), "recipeId should be generated");
  assert.equal(result.domainId, "new-domain");
  assert.equal(result.name, "New Recipe");
  assert.equal(result.archetype, "crud_heavy");
  assert.deepEqual(result.triggerPhrases, ["create", "new"]);
});

test("DomainRecipeService.create uses provided archetype", () => {
  const service = new DomainRecipeService();

  const request: RecipeCreateRequest = {
    domainId: "new-domain",
    archetype: "analytics",
    name: "Analytics Recipe",
    description: "An analytics recipe",
    triggerPhrases: ["analytics"],
    defaultWorkflowId: "analytics_workflow",
  };

  const result = service.create(request);

  assert.equal(result.archetype, "analytics");
});

test("DomainRecipeService.create defaults archetype to crud_heavy", () => {
  const service = new DomainRecipeService();

  const request: RecipeCreateRequest = {
    domainId: "new-domain",
    name: "No Archetype Recipe",
    description: "Recipe without archetype",
    triggerPhrases: ["test"],
    defaultWorkflowId: "workflow",
  };

  const result = service.create(request);

  assert.equal(result.archetype, "crud_heavy");
});

test("DomainRecipeService.update updates existing recipe", () => {
  const service = new DomainRecipeService();
  service.register(createTestRecipe({ recipeId: "update-test", domainId: "test-domain" }));

  const request: RecipeUpdateRequest = {
    recipeId: "update-test",
    name: "Updated Name",
    description: "Updated description",
  };

  const result = service.update(request);

  assert.ok(result != null);
  assert.equal(result.name, "Updated Name");
  assert.equal(result.description, "Updated description");
  assert.equal(result.recipeId, "update-test");
});

test("DomainRecipeService.update returns null for non-existent recipe", () => {
  const service = new DomainRecipeService();

  const request: RecipeUpdateRequest = {
    recipeId: "non-existent",
    name: "Updated Name",
  };

  const result = service.update(request);

  assert.strictEqual(result, null);
});

test("DomainRecipeService.update bumps version on modification", () => {
  const service = new DomainRecipeService();
  service.register(createTestRecipe({ recipeId: "version-test", domainId: "test-domain" }));

  service.update({ recipeId: "version-test", name: "First Update" });
  service.update({ recipeId: "version-test", name: "Second Update" });

  const history = service.getVersionHistory("version-test");

  assert.equal(history.length, 2, "registered recipes start version history on first update");
  assert.equal(history[0]?.version, "1.0.0", "first update seeds version history");
  assert.equal(history[1]?.version, "1.1", "second update bumps minor version");
});

test("DomainRecipeService.update preserves unchanged fields", () => {
  const service = new DomainRecipeService();
  service.register(createTestRecipe({
    recipeId: "preserve-test",
    domainId: "test-domain",
    name: "Original Name",
    description: "Original Description",
    triggerPhrases: ["original"],
  }));

  const result = service.update({
    recipeId: "preserve-test",
    name: "New Name",
  });

  assert.ok(result != null);
  assert.equal(result.name, "New Name");
  assert.equal(result.description, "Original Description");
  assert.deepEqual(result.triggerPhrases, ["original"]);
});

test("DomainRecipeService.delete removes recipe and returns true", () => {
  const service = new DomainRecipeService();
  service.register(createTestRecipe({ recipeId: "delete-test", domainId: "test-domain" }));

  const result = service.delete("delete-test");

  assert.equal(result, true);
  assert.strictEqual(service.getRecipe("delete-test"), null);
});

test("DomainRecipeService.delete returns false for non-existent recipe", () => {
  const service = new DomainRecipeService();

  const result = service.delete("non-existent");

  assert.equal(result, false);
});

test("DomainRecipeService.delete also removes version history", () => {
  const service = new DomainRecipeService();
  service.register(createTestRecipe({ recipeId: "version-delete-test", domainId: "test-domain" }));

  service.update({ recipeId: "version-delete-test", name: "Updated" });
  service.delete("version-delete-test");

  const history = service.getVersionHistory("version-delete-test");

  assert.equal(history.length, 0);
});

test("DomainRecipeService.getPrototypeTemplates returns all 12 templates", () => {
  const service = new DomainRecipeService();

  const templates = service.getPrototypeTemplates();

  assert.equal(templates.length, 12);
});

test("DomainRecipeService.getPrototypeTemplates includes all expected categories", () => {
  const service = new DomainRecipeService();

  const templates = service.getPrototypeTemplates();
  const categories = templates.map((t) => t.category);

  assert.ok(categories.includes("analysis"));
  assert.ok(categories.includes("implementation"));
  assert.ok(categories.includes("review"));
  assert.ok(categories.includes("release"));
  assert.ok(categories.includes("research"));
  assert.ok(categories.includes("operations"));
  assert.ok(categories.includes("compliance"));
  assert.ok(categories.includes("support"));
  assert.ok(categories.includes("creative"));
  assert.ok(categories.includes("optimization"));
  assert.ok(categories.includes("planning"));
  assert.ok(categories.includes("general"));
});

test("DomainRecipeService.getPrototypeTemplate returns specific template", () => {
  const service = new DomainRecipeService();

  const template = service.getPrototypeTemplate("prototype_analysis");

  assert.ok(template != null);
  assert.equal(template.templateId, "prototype_analysis");
  assert.equal(template.name, "Analysis Recipe");
  assert.deepEqual(template.triggerPatterns, ["analyze", "examine", "investigate", "review data", "assess"]);
});

test("DomainRecipeService.getPrototypeTemplate returns null for unknown template", () => {
  const service = new DomainRecipeService();

  const result = service.getPrototypeTemplate("unknown_template");

  assert.strictEqual(result, null);
});

test("DomainRecipeService.createFromPrototype creates recipe from template", () => {
  const service = new DomainRecipeService();

  const result = service.createFromPrototype("new-domain", "prototype_analysis");

  assert.ok(result != null);
  assert.ok(result.recipeId.startsWith("recipe_"));
  assert.equal(result.domainId, "new-domain");
  assert.equal(result.name, "Analysis Recipe");
  assert.equal(result.description, "Template for analysis-type tasks requiring data examination and insights");
  assert.deepEqual(result.triggerPhrases, ["analyze", "examine", "investigate", "review data", "assess"]);
});

test("DomainRecipeService.createFromPrototype applies customizations", () => {
  const service = new DomainRecipeService();

  const result = service.createFromPrototype("new-domain", "prototype_analysis", {
    name: "Custom Analysis",
    description: "Custom description",
  });

  assert.ok(result != null);
  assert.equal(result.name, "Custom Analysis");
  assert.equal(result.description, "Custom description");
  assert.deepEqual(result.triggerPhrases, ["analyze", "examine", "investigate", "review data", "assess"]);
});

test("DomainRecipeService.createFromPrototype returns null for unknown template", () => {
  const service = new DomainRecipeService();

  const result = service.createFromPrototype("new-domain", "unknown_template");

  assert.strictEqual(result, null);
});

test("DomainRecipeService.createFromPrototype defaults tool bundle IDs", () => {
  const service = new DomainRecipeService();

  const result = service.createFromPrototype("new-domain", "prototype_implementation");

  assert.ok(result != null);
  assert.deepEqual(result.defaultToolBundleIds, ["code_tools", "testing_tools"]);
});

test("DomainRecipeService.createFromPrototype allows custom tool bundle IDs", () => {
  const service = new DomainRecipeService();

  const result = service.createFromPrototype("new-domain", "prototype_analysis", {
    defaultToolBundleIds: ["custom_tool_1", "custom_tool_2"],
  });

  assert.ok(result != null);
  assert.deepEqual(result.defaultToolBundleIds, ["custom_tool_1", "custom_tool_2"]);
});

test("DomainRecipeService.getVersionHistory returns empty array for new recipe", () => {
  const service = new DomainRecipeService();

  const history = service.getVersionHistory("new-recipe");

  assert.equal(history.length, 0);
});

test("DomainRecipeService.getVersionHistory records initial version on create", () => {
  const service = new DomainRecipeService();

  service.create({
    domainId: "test-domain",
    name: "Versioned Recipe",
    description: "A recipe with version history",
    triggerPhrases: ["version"],
    defaultWorkflowId: "workflow",
  });

  const allRecipes = service.getRecipesByDomain("test-domain");
  const recipe = allRecipes[0];
  assert.ok(recipe != null);

  const history = service.getVersionHistory(recipe.recipeId);

  assert.ok(history.length >= 1);
  assert.equal(history[0]?.version, "1.0.0");
  assert.equal(history[0]?.changelog, "Initial creation");
});

test("DomainRecipeService.validate returns no errors for valid recipe", () => {
  const service = new DomainRecipeService();

  const errors = service.validate(createTestRecipe({
    recipeId: "valid-recipe",
    domainId: "test-domain",
    triggerPhrases: ["test phrase", "another phrase"],
  }));

  assert.equal(errors.length, 0);
});

test("DomainRecipeService.validate returns error for missing recipeId", () => {
  const service = new DomainRecipeService();

  const errors = service.validate(createTestRecipe({
    recipeId: "",
    domainId: "test-domain",
  }));

  assert.ok(errors.includes("recipe.id_required"));
});

test("DomainRecipeService.validate returns error for missing domainId", () => {
  const service = new DomainRecipeService();

  const errors = service.validate(createTestRecipe({
    recipeId: "test-recipe",
    domainId: "",
  }));

  assert.ok(errors.includes("recipe.domain_id_required"));
});

test("DomainRecipeService.validate returns error for missing defaultWorkflowId", () => {
  const service = new DomainRecipeService();

  const errors = service.validate(createTestRecipe({
    recipeId: "test-recipe",
    domainId: "test-domain",
    defaultWorkflowId: "",
  }));

  assert.ok(errors.includes("recipe.default_workflow_id_required"));
});

test("DomainRecipeService.validate returns error for empty triggerPhrases", () => {
  const service = new DomainRecipeService();

  const errors = service.validate(createTestRecipe({
    recipeId: "test-recipe",
    domainId: "test-domain",
    triggerPhrases: [],
  }));

  assert.ok(errors.includes("recipe.trigger_phrases_required"));
});

test("DomainRecipeService.validate returns error for trigger phrases shorter than 2 chars", () => {
  const service = new DomainRecipeService();

  const errors = service.validate(createTestRecipe({
    recipeId: "test-recipe",
    domainId: "test-domain",
    triggerPhrases: ["a", "valid phrase"],
  }));

  assert.ok(errors.some((e) => e.includes("recipe.trigger_phrase_too_short")));
});

test("DomainRecipeService.validate returns multiple errors for multiple issues", () => {
  const service = new DomainRecipeService();

  const errors = service.validate(createTestRecipe({
    recipeId: "",
    domainId: "",
    defaultWorkflowId: "",
    triggerPhrases: [],
  }));

  assert.ok(errors.length >= 3);
});

test("DomainRecipeService prototype templates have all required fields", () => {
  const service = new DomainRecipeService();
  const templates = service.getPrototypeTemplates();

  for (const template of templates) {
    assert.ok(template.templateId != null && template.templateId.length > 0);
    assert.ok(template.name != null && template.name.length > 0);
    assert.ok(template.description != null && template.description.length > 0);
    assert.ok(template.category != null);
    assert.ok(template.triggerPatterns != null && template.triggerPatterns.length > 0);
    assert.ok(template.defaultWorkflowId != null && template.defaultWorkflowId.length > 0);
    assert.ok(template.defaultToolBundleIds != null && template.defaultToolBundleIds.length > 0);
  }
});

test("DomainRecipeService prototype templates include estimatedDurationMinutes", () => {
  const service = new DomainRecipeService();
  const templates = service.getPrototypeTemplates();

  for (const template of templates) {
    assert.ok(template.estimatedDurationMinutes != null);
    assert.ok(template.estimatedDurationMinutes > 0);
  }
});
