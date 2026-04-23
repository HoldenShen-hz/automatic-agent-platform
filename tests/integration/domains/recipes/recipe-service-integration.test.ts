import assert from "node:assert/strict";
import test from "node:test";

import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { DomainRecipeService } from "../../../../src/domains/domain-recipe-service.js";
import type { DomainRecipe } from "../../../../src/domains/recipes/index.js";

test("integration: DomainRecipeService registers and retrieves recipes", () => {
  const service = new DomainRecipeService();

  const recipe: DomainRecipe = {
    recipeId: newId("recipe"),
    domainId: "recipe-domain",
    name: "Test Recipe",
    description: "A test recipe",
    triggerPhrases: ["test", "run", "execute"],
    defaultWorkflowId: "test_workflow",
    defaultToolBundleIds: ["tools1", "tools2"],
  };

  service.register(recipe);

  const retrieved = service.getRecipe(recipe.recipeId);
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.name, "Test Recipe");
  assert.equal(retrieved!.triggerPhrases.length, 3);
});

test("integration: DomainRecipeService retrieves recipes by domain", () => {
  const service = new DomainRecipeService();

  service.register({
    recipeId: newId("recipe"),
    domainId: "multi-domain",
    name: "Recipe 1",
    description: "",
    triggerPhrases: ["test1"],
    defaultWorkflowId: "wf1",
    defaultToolBundleIds: [],
  });

  service.register({
    recipeId: newId("recipe"),
    domainId: "multi-domain",
    name: "Recipe 2",
    description: "",
    triggerPhrases: ["test2"],
    defaultWorkflowId: "wf2",
    defaultToolBundleIds: [],
  });

  service.register({
    recipeId: newId("recipe"),
    domainId: "other-domain",
    name: "Recipe 3",
    description: "",
    triggerPhrases: ["test3"],
    defaultWorkflowId: "wf3",
    defaultToolBundleIds: [],
  });

  const domainRecipes = service.getRecipesByDomain("multi-domain");
  assert.equal(domainRecipes.length, 2);
  assert.ok(domainRecipes.every((r) => r.domainId === "multi-domain"));
});

test("integration: DomainRecipeService matches recipe by trigger phrase", () => {
  const service = new DomainRecipeService();

  service.register({
    recipeId: newId("recipe"),
    domainId: "match-domain",
    name: "Analysis Recipe",
    description: "For analysis tasks",
    triggerPhrases: ["analyze", "examine", "investigate"],
    defaultWorkflowId: "analysis_wf",
    defaultToolBundleIds: [],
  });

  service.register({
    recipeId: newId("recipe"),
    domainId: "match-domain",
    name: "Implementation Recipe",
    description: "For implementation tasks",
    triggerPhrases: ["implement", "create", "build"],
    defaultWorkflowId: "impl_wf",
    defaultToolBundleIds: [],
  });

  const matched = service.matchRecipe("match-domain", "Please analyze this data");
  assert.notEqual(matched, null);
  assert.equal(matched!.name, "Analysis Recipe");

  const matchedImpl = service.matchRecipe("match-domain", "Implement a new feature");
  assert.notEqual(matchedImpl, null);
  assert.equal(matchedImpl!.name, "Implementation Recipe");

  const noMatch = service.matchRecipe("match-domain", "Do something random");
  assert.equal(noMatch, null);
});

test("integration: DomainRecipeService creates recipes with version history", () => {
  const service = new DomainRecipeService();

  const created = service.create({
    domainId: "create-domain",
    name: "Created Recipe",
    description: "Created via service",
    triggerPhrases: ["create", "new"],
    defaultWorkflowId: "create_wf",
    defaultToolBundleIds: ["bundle1"],
  });

  assert.equal(created.recipeId.startsWith("recipe_"), true);
  assert.equal(created.name, "Created Recipe");

  const versions = service.getVersionHistory(created.recipeId);
  assert.equal(versions.length, 1);
  assert.equal(versions[0]!.version, "1.0.0");
});

test("integration: DomainRecipeService updates recipes and bumps version", () => {
  const service = new DomainRecipeService();

  const created = service.create({
    domainId: "update-domain",
    name: "Original Name",
    description: "Original description",
    triggerPhrases: ["original"],
    defaultWorkflowId: "original_wf",
    defaultToolBundleIds: [],
  });

  const updated = service.update({
    recipeId: created.recipeId,
    name: "Updated Name",
    description: "Updated description",
    triggerPhrases: ["updated", "modified"],
  });

  assert.notEqual(updated, null);
  assert.equal(updated!.name, "Updated Name");
  assert.equal(updated!.triggerPhrases.length, 2);

  const versions = service.getVersionHistory(created.recipeId);
  assert.equal(versions.length, 2);
  assert.equal(versions[1]!.version, "1.1");
});

test("integration: DomainRecipeService deletes recipes", () => {
  const service = new DomainRecipeService();

  const created = service.create({
    domainId: "delete-domain",
    name: "To Be Deleted",
    description: "",
    triggerPhrases: ["delete"],
    defaultWorkflowId: "delete_wf",
    defaultToolBundleIds: [],
  });

  assert.notEqual(service.getRecipe(created.recipeId), null);

  const deleted = service.delete(created.recipeId);
  assert.equal(deleted, true);
  assert.equal(service.getRecipe(created.recipeId), null);

  const deleteNonexistent = service.delete("nonexistent-id");
  assert.equal(deleteNonexistent, false);
});

test("integration: DomainRecipeService provides prototype templates", () => {
  const service = new DomainRecipeService();

  const templates = service.getPrototypeTemplates();
  assert.ok(templates.length >= 12);

  const analysisTemplate = service.getPrototypeTemplate("prototype_analysis");
  assert.notEqual(analysisTemplate, null);
  assert.equal(analysisTemplate!.name, "Analysis Recipe");
  assert.equal(analysisTemplate!.category, "analysis");

  const nonexistent = service.getPrototypeTemplate("nonexistent");
  assert.equal(nonexistent, null);
});

test("integration: DomainRecipeService creates recipes from prototype", () => {
  const service = new DomainRecipeService();

  const fromPrototype = service.createFromPrototype(
    "prototype-domain",
    "prototype_analysis",
    {
      name: "Custom Analysis",
      description: "Customized analysis recipe",
    },
  );

  assert.notEqual(fromPrototype, null);
  assert.equal(fromPrototype!.name, "Custom Analysis");
  assert.equal(fromPrototype!.domainId, "prototype-domain");
  assert.equal(fromPrototype!.triggerPhrases.length > 0, true);

  const failedPrototype = service.createFromPrototype(
    "prototype-domain",
    "nonexistent_template",
  );
  assert.equal(failedPrototype, null);
});

test("integration: DomainRecipeService validates recipes", () => {
  const service = new DomainRecipeService();

  const validRecipe: DomainRecipe = {
    recipeId: "valid-id",
    domainId: "valid-domain",
    name: "Valid",
    description: "Valid recipe",
    triggerPhrases: ["valid", "test"],
    defaultWorkflowId: "wf",
    defaultToolBundleIds: [],
  };

  const errors = service.validate(validRecipe);
  assert.equal(errors.length, 0);

  const invalidRecipe: DomainRecipe = {
    recipeId: "",
    domainId: "",
    name: "Invalid",
    description: "",
    triggerPhrases: [],
    defaultWorkflowId: "",
    defaultToolBundleIds: [],
  };

  const validationErrors = service.validate(invalidRecipe);
  assert.ok(validationErrors.length > 0);
  assert.ok(validationErrors.some((e) => e.includes("id_required") || e.includes("domain_id_required")));
});

test("integration: DomainRecipeService update returns null for nonexistent", () => {
  const service = new DomainRecipeService();

  const result = service.update({
    recipeId: "nonexistent",
    name: "New Name",
  });

  assert.equal(result, null);
});
