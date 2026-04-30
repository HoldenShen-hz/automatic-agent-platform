/**
 * Integration Test: Recipe Executor with Real Workflow Lookup (Issue 1983)
 *
 * Tests RecipeExecutor workflow validation:
 * - Workflow existence validation during recipe execution
 * - Error handling for non-existent workflows
 * - Successful execution with valid workflow references
 * - Context propagation in execution results
 */

import test from "node:test";
import assert from "node:assert/strict";
import { RecipeExecutor, type RecipeExecutionContext, type RecipeExecutionResult } from "../../../../src/domains/recipes/recipe-executor.js";
import { DomainRecipeSchema, type DomainRecipe } from "../../../../src/domains/recipes/index.js";

function createRecipe(overrides: Partial<DomainRecipe> = {}): DomainRecipe {
  const validRecipe: DomainRecipe = {
    recipeId: "test-recipe",
    domainId: "test-domain",
    name: "Test Recipe",
    description: "A test recipe",
    triggerPhrases: ["test", "run"],
    defaultWorkflowId: "wf_valid",
    defaultToolBundleIds: ["bundle1"],
    archetype: "crud_heavy",
    risk_profile_ref: "risk-default",
    guardrail_overlay: "guard-default",
    recommended_workflow_ids: [],
    default_prompt_bundle_ref: "prompt-default",
    acceptance_checklist_ref: "checklist-default",
    ...overrides,
  };
  return DomainRecipeSchema.parse(validRecipe);
}

function createContext(overrides: Partial<RecipeExecutionContext> = {}): RecipeExecutionContext {
  return {
    executionId: "exec-001",
    taskId: "task-001",
    tenantId: "tenant-001",
    correlationId: "corr-001",
    input: "test input",
    ...overrides,
  };
}

test("recipe executor: successful execution with valid workflow", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({ recipeId: "recipe-success", defaultWorkflowId: "wf_primary" });
  const context = createContext();

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.equal(result.recipeId, "recipe-success");
  assert.equal(result.workflowId, "wf_primary");
  assert.deepEqual(result.toolBundleIds, ["bundle1"]);
  assert.ok(result.output);
  assert.equal(result.output!.taskId, context.taskId);
  assert.equal(result.output!.tenantId, context.tenantId);
  assert.equal(result.output!.correlationId, context.correlationId);
});

test("recipe executor: failure with nonexistent workflow", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({ recipeId: "recipe-nonexistent", defaultWorkflowId: "nonexistent_workflow" });
  const context = createContext();

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, false);
  assert.equal(result.recipeId, "recipe-nonexistent");
  assert.ok(result.error!.includes("nonexistent_workflow") || result.error!.includes("not available"));
});

test("recipe executor: case-insensitive nonexistent workflow detection", async () => {
  const executor = new RecipeExecutor();

  const lowercaseNonexistent = createRecipe({ recipeId: "r1", defaultWorkflowId: "nonexistent" });
  const uppercaseNonexistent = createRecipe({ recipeId: "r2", defaultWorkflowId: "NONEXISTENT" });
  const mixedCaseNonexistent = createRecipe({ recipeId: "r3", defaultWorkflowId: "NonExistent" });

  const context = createContext();

  const resultLower = await executor.execute(lowercaseNonexistent, context);
  const resultUpper = await executor.execute(uppercaseNonexistent, context);
  const resultMixed = await executor.execute(mixedCaseNonexistent, context);

  assert.equal(resultLower.success, false);
  assert.equal(resultUpper.success, false);
  assert.equal(resultMixed.success, false);
});

test("recipe executor: preserves execution ID in result", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({ recipeId: "recipe-exec-id" });
  const context = createContext({ executionId: "custom-exec-123" });

  const result = await executor.execute(recipe, context);

  assert.equal(result.executionId, "custom-exec-123");
});

test("recipe executor: handles multiple tool bundle IDs", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({ recipeId: "recipe-multi-bundle", defaultToolBundleIds: ["bundle1", "bundle2", "bundle3"] });
  const context = createContext();

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.deepEqual(result.toolBundleIds, ["bundle1", "bundle2", "bundle3"]);
});

test("recipe executor: workflow with valid name succeeds", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({ recipeId: "recipe-wf-name", defaultWorkflowId: "analysis_workflow" });
  const context = createContext();

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.equal(result.workflowId, "analysis_workflow");
});

test("recipe executor: schema validation on recipe input", async () => {
  const executor = new RecipeExecutor();
  const invalidRecipe = {
    recipeId: "",
    domainId: "",
    defaultWorkflowId: "",
    defaultToolBundleIds: [],
  } as DomainRecipe;
  const context = createContext();

  const result = await executor.execute(invalidRecipe, context);

  assert.equal(result.success, false);
  assert.ok(result.error);
});

test("recipe executor: context input is preserved in output", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({ recipeId: "recipe-context-input" });
  const context = createContext({ input: "specific test input for processing" });

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.ok(result.output);
  assert.equal(result.output!.input, "specific test input for processing");
});