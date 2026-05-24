import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainRecipeSchema,
  matchDomainRecipe,
  type DomainRecipe,
} from "../../../../src/domains/recipes/index.js";

function makeRecipe(overrides: Partial<DomainRecipe>): DomainRecipe {
  return DomainRecipeSchema.parse({
    recipeId: "recipe_default",
    domainId: "coding",
    archetype: "crud_heavy",
    riskProfileRef: "coding.risk",
    guardrailOverlay: {},
    triggerPhrases: [],
    defaultWorkflowId: "workflow_default",
    recommendedWorkflowIds: [],
    defaultToolBundleIds: [],
    defaultPromptBundleRef: "coding.default-prompt",
    acceptanceChecklistRef: "coding.acceptance",
    ...overrides,
  });
}

function makeRecipeInput(overrides: Partial<DomainRecipe>): DomainRecipe {
  return {
    recipeId: "recipe_default",
    domainId: "coding",
    archetype: "crud_heavy",
    riskProfileRef: "coding.risk",
    guardrailOverlay: {},
    triggerPhrases: [],
    defaultWorkflowId: "workflow_default",
    recommendedWorkflowIds: [],
    defaultToolBundleIds: [],
    defaultPromptBundleRef: "coding.default-prompt",
    acceptanceChecklistRef: "coding.acceptance",
    ...overrides,
  };
}

test("DomainRecipeSchema parses valid recipe", () => {
  const recipe = makeRecipe({
    recipeId: "recipe_coding",
    domainId: "coding",
    name: "Coding Recipe",
    description: "A recipe for coding tasks",
    triggerPhrases: ["write code", "implement", "develop"],
    defaultWorkflowId: "coding_workflow",
    defaultToolBundleIds: ["repo_tools", "build_tools"],
  });
  const result = DomainRecipeSchema.safeParse(recipe);
  assert.equal(result.success, true);
});

test("DomainRecipeSchema applies default values", () => {
  const recipe = makeRecipe({
    recipeId: "recipe_minimal",
    domainId: "coding",
    defaultWorkflowId: "workflow_1",
  });
  const result = DomainRecipeSchema.parse(recipe);
  assert.deepEqual(result.triggerPhrases, []);
  assert.deepEqual(result.defaultToolBundleIds, []);
});

test("DomainRecipeSchema requires recipeId to be non-empty", () => {
  const recipe = makeRecipeInput({
    recipeId: "",
  });
  const result = DomainRecipeSchema.safeParse(recipe);
  assert.equal(result.success, false);
});

test("DomainRecipeSchema requires domainId to be non-empty", () => {
  const recipe = makeRecipeInput({
    recipeId: "recipe_1",
    domainId: "",
  });
  const result = DomainRecipeSchema.safeParse(recipe);
  assert.equal(result.success, false);
});

test("DomainRecipeSchema requires defaultWorkflowId to be non-empty", () => {
  const recipe = makeRecipeInput({
    recipeId: "recipe_1",
    defaultWorkflowId: "",
  });
  const result = DomainRecipeSchema.safeParse(recipe);
  assert.equal(result.success, false);
});

test("matchDomainRecipe returns recipe when input matches trigger phrase", () => {
  const recipes = [
    makeRecipe({
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: ["write code", "implement"],
      defaultWorkflowId: "workflow_1",
    }),
    makeRecipe({
      recipeId: "recipe_2",
      domainId: "coding",
      triggerPhrases: ["deploy", "release"],
      defaultWorkflowId: "workflow_2",
    }),
  ];

  const result = matchDomainRecipe(recipes, "Please write code for me");
  assert.ok(result);
  assert.equal(result.recipeId, "recipe_1");
});

test("matchDomainRecipe is case insensitive", () => {
  const recipes = [
    makeRecipe({
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: ["Write Code", "Implement"],
      defaultWorkflowId: "workflow_1",
    }),
  ];

  const result = matchDomainRecipe(recipes, "please WRITE CODE for me");
  assert.ok(result);
  assert.equal(result.recipeId, "recipe_1");
});

test("matchDomainRecipe returns first matching recipe", () => {
  const recipes = [
    makeRecipe({
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: ["code"],
      defaultWorkflowId: "workflow_1",
    }),
    makeRecipe({
      recipeId: "recipe_2",
      domainId: "coding",
      triggerPhrases: ["code"],
      defaultWorkflowId: "workflow_2",
    }),
  ];

  const result = matchDomainRecipe(recipes, "write some code");
  assert.ok(result);
  assert.equal(result.recipeId, "recipe_1");
});

test("matchDomainRecipe returns null when no recipe matches", () => {
  const recipes = [
    makeRecipe({
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: ["write code"],
      defaultWorkflowId: "workflow_1",
    }),
  ];

  const result = matchDomainRecipe(recipes, "deploy the application");
  assert.equal(result, null);
});

test("matchDomainRecipe returns null for empty recipes array", () => {
  const result = matchDomainRecipe([], "write code");
  assert.equal(result, null);
});

test("matchDomainRecipe matches partial phrase (substring)", () => {
  const recipes = [
    makeRecipe({
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: ["implement feature"],
      defaultWorkflowId: "workflow_1",
    }),
  ];

  const result = matchDomainRecipe(recipes, "I need to implement feature X");
  assert.ok(result);
  assert.equal(result.recipeId, "recipe_1");
});

test("matchDomainRecipe handles empty trigger phrases array", () => {
  const recipes = [
    makeRecipe({
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: [],
      defaultWorkflowId: "workflow_1",
    }),
  ];

  const result = matchDomainRecipe(recipes, "any input");
  assert.equal(result, null);
});
