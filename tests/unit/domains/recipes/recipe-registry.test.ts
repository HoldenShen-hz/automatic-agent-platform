/**
 * RecipeRegistry Unit Tests
 *
 * Tests for:
 * - Recipe registration and storage
 * - Recipe lookup by ID
 * - Recipe listing and filtering
 * - Domain recipe matching integration
 */

// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { DomainRecipeSchema, matchDomainRecipe } from "../../../../src/domains/recipes/index.js";
import type { DomainRecipe } from "../../../../src/domains/recipes/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeRecipe(overrides: Partial<DomainRecipe> & { recipeId: string; domainId: string; defaultWorkflowId: string }): DomainRecipe {
  return DomainRecipeSchema.parse({
    recipeId: overrides.recipeId,
    domainId: overrides.domainId,
    name: overrides.name ?? `Recipe ${overrides.recipeId}`,
    description: overrides.description,
    triggerPhrases: overrides.triggerPhrases ?? [],
    defaultWorkflowId: overrides.defaultWorkflowId,
    defaultToolBundleIds: overrides.defaultToolBundleIds ?? [],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Construction & Basic Operations Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeRegistry is constructed without errors", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  assert.ok(registry !== null);
});

test("RecipeRegistry.register adds a recipe to the registry", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  const recipe = makeRecipe({
    recipeId: "recipe_register",
    domainId: "coding",
    defaultWorkflowId: "wf_coding",
  });

  registry.register(recipe);
  const result = registry.get(recipe.recipeId);

  assert.ok(result !== null);
  assert.equal(result!.recipeId, recipe.recipeId);
  assert.equal(result!.domainId, recipe.domainId);
  assert.equal(result!.defaultWorkflowId, recipe.defaultWorkflowId);
});

test("RecipeRegistry.registerAll adds multiple recipes", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  const recipes = [
    makeRecipe({ recipeId: "recipe_multi_1", domainId: "coding", defaultWorkflowId: "wf_1" }),
    makeRecipe({ recipeId: "recipe_multi_2", domainId: "coding", defaultWorkflowId: "wf_2" }),
    makeRecipe({ recipeId: "recipe_multi_3", domainId: "data", defaultWorkflowId: "wf_3" }),
  ];

  registry.registerAll(recipes);
  const list = registry.list();

  assert.equal(list.length, 3);
});

test("RecipeRegistry.get returns recipe by id", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  const recipe = makeRecipe({
    recipeId: "recipe_get",
    domainId: "coding",
    defaultWorkflowId: "wf_get",
  });

  registry.register(recipe);
  const result = registry.get("recipe_get");

  assert.ok(result !== null);
  assert.equal(result!.recipeId, "recipe_get");
});

test("RecipeRegistry.get returns null for unknown id", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();

  const result = registry.get("nonexistent_recipe");

  assert.equal(result, null);
});

test("RecipeRegistry.list returns all registered recipes", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.registerAll([
    makeRecipe({ recipeId: "recipe_list_1", domainId: "coding", defaultWorkflowId: "wf_1" }),
    makeRecipe({ recipeId: "recipe_list_2", domainId: "data", defaultWorkflowId: "wf_2" }),
  ]);

  const result = registry.list();

  assert.equal(result.length, 2);
});

test("RecipeRegistry.list returns a copy (immutability)", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_copy",
    domainId: "coding",
    defaultWorkflowId: "wf_copy",
  }));

  const list1 = registry.list();
  list1.push(makeRecipe({ recipeId: "tamper", domainId: "x", defaultWorkflowId: "y" }));

  const list2 = registry.list();
  assert.equal(list2.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Registration Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeRegistry.registerAll rejects duplicate recipe ids", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  const recipe1 = makeRecipe({
    recipeId: "recipe_dup",
    domainId: "coding",
    defaultWorkflowId: "wf_original",
  });
  const recipe2 = makeRecipe({
    recipeId: "recipe_dup",
    domainId: "data",
    defaultWorkflowId: "wf_replacement",
  });

  registry.register(recipe1);
  assert.throws(() => registry.register(recipe2), /Recipe uniqueness conflict/);

  const result = registry.get("recipe_dup");
  assert.equal(result!.defaultWorkflowId, "wf_original");
  assert.equal(registry.list().length, 1);
});

test("RecipeRegistry.register rejects invalid recipe schema", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();

  assert.throws(() => {
    registry.register({
      recipeId: "",
      domainId: "coding",
      defaultWorkflowId: "wf_1",
    } as DomainRecipe);
  });
});

test("RecipeRegistry.clear removes all recipes", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.registerAll([
    makeRecipe({ recipeId: "recipe_clear_1", domainId: "coding", defaultWorkflowId: "wf_1" }),
    makeRecipe({ recipeId: "recipe_clear_2", domainId: "data", defaultWorkflowId: "wf_2" }),
  ]);

  registry.clear();

  assert.equal(registry.list().length, 0);
});

test("RecipeRegistry.has returns true for existing recipe", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_has",
    domainId: "coding",
    defaultWorkflowId: "wf_has",
  }));

  assert.equal(registry.has("recipe_has"), true);
});

test("RecipeRegistry.has returns false for unknown recipe", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();

  assert.equal(registry.has("nonexistent"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Filtering & Query Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeRegistry.listByDomain returns recipes for specific domain", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.registerAll([
    makeRecipe({ recipeId: "recipe_domain_1", domainId: "coding", defaultWorkflowId: "wf_1" }),
    makeRecipe({ recipeId: "recipe_domain_2", domainId: "coding", defaultWorkflowId: "wf_2" }),
    makeRecipe({ recipeId: "recipe_domain_3", domainId: "data", defaultWorkflowId: "wf_3" }),
  ]);

  const result = registry.listByDomain("coding");

  assert.equal(result.length, 2);
  assert.ok(result.every((r: DomainRecipe) => r.domainId === "coding"));
});

test("RecipeRegistry.listByDomain returns empty array when no recipes for domain", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_other",
    domainId: "coding",
    defaultWorkflowId: "wf_1",
  }));

  const result = registry.listByDomain("nonexistent_domain");

  assert.equal(result.length, 0);
});

test("RecipeRegistry.findByTriggerPhrase matches recipes by trigger phrase", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.registerAll([
    makeRecipe({
      recipeId: "recipe_trigger_1",
      domainId: "coding",
      defaultWorkflowId: "wf_1",
      triggerPhrases: ["write code", "implement"],
    }),
    makeRecipe({
      recipeId: "recipe_trigger_2",
      domainId: "data",
      defaultWorkflowId: "wf_2",
      triggerPhrases: ["analyze data", "query"],
    }),
  ]);

  const result = registry.findByTriggerPhrase("I need to write code for my project");

  assert.ok(result !== null);
  assert.equal(result!.recipeId, "recipe_trigger_1");
});

test("RecipeRegistry.findByTriggerPhrase is case insensitive", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_case",
    domainId: "coding",
    defaultWorkflowId: "wf_case",
    triggerPhrases: ["Write Code", "Implement"],
  }));

  const result = registry.findByTriggerPhrase("please WRITE CODE for me");

  assert.ok(result !== null);
  assert.equal(result!.recipeId, "recipe_case");
});

test("RecipeRegistry.findByTriggerPhrase returns null when no match", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_no_match",
    domainId: "coding",
    defaultWorkflowId: "wf_no_match",
    triggerPhrases: ["deploy", "release"],
  }));

  const result = registry.findByTriggerPhrase("write some code");

  assert.equal(result, null);
});

test("RecipeRegistry.findByTriggerPhrase returns first matching recipe", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.registerAll([
    makeRecipe({
      recipeId: "recipe_first_1",
      domainId: "coding",
      defaultWorkflowId: "wf_1",
      triggerPhrases: ["code"],
    }),
    makeRecipe({
      recipeId: "recipe_first_2",
      domainId: "data",
      defaultWorkflowId: "wf_2",
      triggerPhrases: ["code"],
    }),
  ]);

  const result = registry.findByTriggerPhrase("write some code");

  assert.ok(result !== null);
  assert.equal(result!.recipeId, "recipe_first_1");
});

test("RecipeRegistry.findByTriggerPhrase delegates to matchDomainRecipe", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_delegate",
    domainId: "coding",
    defaultWorkflowId: "wf_delegate",
    triggerPhrases: ["analyze"],
  }));

  // Uses same matching logic as matchDomainRecipe
  const result = registry.findByTriggerPhrase("analyze this data");
  assert.ok(result !== null);
  assert.equal(result!.recipeId, "recipe_delegate");

  const noMatch = registry.findByTriggerPhrase("deploy application");
  assert.equal(noMatch, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty State Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeRegistry.list on empty registry returns empty array", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();

  const result = registry.list();

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("RecipeRegistry.listByDomain on empty registry returns empty array", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();

  const result = registry.listByDomain("any_domain");

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("RecipeRegistry.findByTriggerPhrase on empty registry returns null", async () => {
  const { RecipeRegistry } = await import("../../../../src/domains/recipes/recipe-registry.js");
  const registry = new RecipeRegistry();

  const result = registry.findByTriggerPhrase("any input");

  assert.equal(result, null);
});
