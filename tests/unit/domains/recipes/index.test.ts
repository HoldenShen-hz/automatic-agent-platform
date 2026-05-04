import assert from "node:assert/strict";
import test from "node:test";

import { DomainRecipeSchema, matchDomainRecipe, type DomainRecipe } from "../../../../src/domains/recipes/index.js";

test("DomainRecipeSchema parses valid recipe", () => {
  const recipe = {
    recipeId: "recipe_coding",
    domainId: "coding",
    name: "Coding Recipe",
    description: "A recipe for coding tasks",
    triggerPhrases: ["write code", "implement", "develop"],
    defaultWorkflowId: "coding_workflow",
    defaultToolBundleIds: ["repo_tools", "build_tools"],
  };
  const result = DomainRecipeSchema.safeParse(recipe);
  assert.equal(result.success, true);
});

test("DomainRecipeSchema applies default values", () => {
  const recipe = {
    recipeId: "recipe_minimal",
    domainId: "coding",
    defaultWorkflowId: "workflow_1",
  };
  const result = DomainRecipeSchema.parse(recipe);
  assert.deepEqual(result.triggerPhrases, []);
  assert.deepEqual(result.defaultToolBundleIds, []);
  assert.equal(result.riskLevel, "medium");
  assert.equal(result.budgetHint, undefined);
  assert.equal(result.requiredApproval, false);
});

test("DomainRecipeSchema requires recipeId to be non-empty", () => {
  const recipe = {
    recipeId: "",
    domainId: "coding",
    defaultWorkflowId: "workflow_1",
  };
  const result = DomainRecipeSchema.safeParse(recipe);
  assert.equal(result.success, false);
});

test("DomainRecipeSchema requires domainId to be non-empty", () => {
  const recipe = {
    recipeId: "recipe_1",
    domainId: "",
    defaultWorkflowId: "workflow_1",
  };
  const result = DomainRecipeSchema.safeParse(recipe);
  assert.equal(result.success, false);
});

test("DomainRecipeSchema requires defaultWorkflowId to be non-empty", () => {
  const recipe = {
    recipeId: "recipe_1",
    domainId: "coding",
    defaultWorkflowId: "",
  };
  const result = DomainRecipeSchema.safeParse(recipe);
  assert.equal(result.success, false);
});

test("matchDomainRecipe returns recipe when input matches trigger phrase", () => {
  const recipes: DomainRecipe[] = [
    {
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: ["write code", "implement"],
      defaultWorkflowId: "workflow_1",
      defaultToolBundleIds: [],
      name: "Recipe 1",
      archetype: "crud_heavy",
      riskLevel: "medium",
      risk_profile_ref: "coding.risk",
      guardrail_overlay: "coding.guardrails",
      recommended_workflow_ids: [],
      default_prompt_bundle_ref: "coding.prompts",
      acceptance_checklist_ref: "coding.acceptance",
      requiredApproval: false,
    },
    {
      recipeId: "recipe_2",
      domainId: "coding",
      triggerPhrases: ["deploy", "release"],
      defaultWorkflowId: "workflow_2",
      defaultToolBundleIds: [],
      name: "Recipe 2",
      archetype: "crud_heavy",
      riskLevel: "medium",
      risk_profile_ref: "coding.risk",
      guardrail_overlay: "coding.guardrails",
      recommended_workflow_ids: [],
      default_prompt_bundle_ref: "coding.prompts",
      acceptance_checklist_ref: "coding.acceptance",
      requiredApproval: false,
    },
  ];

  const result = matchDomainRecipe(recipes, "Please write code for me");
  assert.ok(result);
  assert.equal(result.recipeId, "recipe_1");
});

test("matchDomainRecipe is case insensitive", () => {
  const recipes: DomainRecipe[] = [
    {
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: ["Write Code", "Implement"],
      defaultWorkflowId: "workflow_1",
      defaultToolBundleIds: [],
      name: "Recipe 1",
      archetype: "crud_heavy",
      riskLevel: "medium",
      risk_profile_ref: "coding.risk",
      guardrail_overlay: "coding.guardrails",
      recommended_workflow_ids: [],
      default_prompt_bundle_ref: "coding.prompts",
      acceptance_checklist_ref: "coding.acceptance",
      requiredApproval: false,
    },
  ];

  const result = matchDomainRecipe(recipes, "please WRITE CODE for me");
  assert.ok(result);
  assert.equal(result.recipeId, "recipe_1");
});

test("matchDomainRecipe returns first matching recipe", () => {
  const recipes: DomainRecipe[] = [
    {
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: ["code"],
      defaultWorkflowId: "workflow_1",
      defaultToolBundleIds: [],
      name: "Recipe 1",
      archetype: "crud_heavy",
      riskLevel: "medium",
      risk_profile_ref: "coding.risk",
      guardrail_overlay: "coding.guardrails",
      recommended_workflow_ids: [],
      default_prompt_bundle_ref: "coding.prompts",
      acceptance_checklist_ref: "coding.acceptance",
      requiredApproval: false,
    },
    {
      recipeId: "recipe_2",
      domainId: "coding",
      triggerPhrases: ["code"],
      defaultWorkflowId: "workflow_2",
      defaultToolBundleIds: [],
      name: "Recipe 2",
      archetype: "crud_heavy",
      riskLevel: "medium",
      risk_profile_ref: "coding.risk",
      guardrail_overlay: "coding.guardrails",
      recommended_workflow_ids: [],
      default_prompt_bundle_ref: "coding.prompts",
      acceptance_checklist_ref: "coding.acceptance",
      requiredApproval: false,
    },
  ];

  const result = matchDomainRecipe(recipes, "write some code");
  assert.ok(result);
  assert.equal(result.recipeId, "recipe_1");
});

test("matchDomainRecipe returns null when no recipe matches", () => {
  const recipes: DomainRecipe[] = [
    {
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: ["write code"],
      defaultWorkflowId: "workflow_1",
      defaultToolBundleIds: [],
      name: "Recipe 1",
      archetype: "crud_heavy",
      riskLevel: "medium",
      risk_profile_ref: "coding.risk",
      guardrail_overlay: "coding.guardrails",
      recommended_workflow_ids: [],
      default_prompt_bundle_ref: "coding.prompts",
      acceptance_checklist_ref: "coding.acceptance",
      requiredApproval: false,
    },
  ];

  const result = matchDomainRecipe(recipes, "deploy the application");
  assert.equal(result, null);
});

test("matchDomainRecipe returns null for empty recipes array", () => {
  const result = matchDomainRecipe([], "write code");
  assert.equal(result, null);
});

test("matchDomainRecipe matches partial phrase (substring)", () => {
  const recipes: DomainRecipe[] = [
    {
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: ["implement feature"],
      defaultWorkflowId: "workflow_1",
      defaultToolBundleIds: [],
      name: "Recipe 1",
      archetype: "crud_heavy",
      riskLevel: "medium",
      risk_profile_ref: "coding.risk",
      guardrail_overlay: "coding.guardrails",
      recommended_workflow_ids: [],
      default_prompt_bundle_ref: "coding.prompts",
      acceptance_checklist_ref: "coding.acceptance",
      requiredApproval: false,
    },
  ];

  const result = matchDomainRecipe(recipes, "I need to implement feature X");
  assert.ok(result);
  assert.equal(result.recipeId, "recipe_1");
});

test("matchDomainRecipe handles empty trigger phrases array", () => {
  const recipes: DomainRecipe[] = [
    {
      recipeId: "recipe_1",
      domainId: "coding",
      triggerPhrases: [],
      defaultWorkflowId: "workflow_1",
      defaultToolBundleIds: [],
      name: "Recipe 1",
      archetype: "crud_heavy",
      riskLevel: "medium",
      risk_profile_ref: "coding.risk",
      guardrail_overlay: "coding.guardrails",
      recommended_workflow_ids: [],
      default_prompt_bundle_ref: "coding.prompts",
      acceptance_checklist_ref: "coding.acceptance",
      requiredApproval: false,
    },
  ];

  const result = matchDomainRecipe(recipes, "any input");
  assert.equal(result, null);
});
