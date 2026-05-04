import assert from "node:assert/strict";
import test from "node:test";

import { RecipeExecutor, type RecipeExecutionContext } from "../../../../src/domains/recipes/recipe-executor.js";
import { DomainRecipeSchema, type DomainRecipe } from "../../../../src/domains/recipes/index.js";
import { WorkflowRegistry } from "../../../../src/domains/registry/workflow-registry.js";

function createRecipe(
  overrides: Partial<DomainRecipe> & { recipeId: string; domainId: string; defaultWorkflowId: string },
): DomainRecipe {
  return DomainRecipeSchema.parse({
    recipeId: overrides.recipeId,
    domainId: overrides.domainId,
    name: overrides.name ?? `Recipe ${overrides.recipeId}`,
    description: overrides.description ?? "Test recipe",
    triggerPhrases: overrides.triggerPhrases ?? [`trigger ${overrides.recipeId}`],
    risk_profile_ref: overrides.risk_profile_ref ?? `${overrides.domainId}.risk`,
    guardrail_overlay: overrides.guardrail_overlay ?? `${overrides.domainId}.guardrails`,
    default_prompt_bundle_ref: overrides.default_prompt_bundle_ref ?? `${overrides.domainId}.prompts`,
    acceptance_checklist_ref: overrides.acceptance_checklist_ref ?? `${overrides.domainId}.acceptance`,
    defaultWorkflowId: overrides.defaultWorkflowId,
    defaultToolBundleIds: overrides.defaultToolBundleIds ?? [],
  });
}

function createContext(overrides: Partial<RecipeExecutionContext> = {}): RecipeExecutionContext {
  return {
    executionId: overrides.executionId ?? "exec_001",
    taskId: overrides.taskId ?? "task_001",
    tenantId: overrides.tenantId ?? "tenant_001",
    correlationId: overrides.correlationId ?? "corr_001",
    input: overrides.input ?? "test input",
  };
}

function createExecutor(workflowIds: readonly string[]): RecipeExecutor {
  const registry = new WorkflowRegistry();
  registry.registerAll(
    workflowIds.map((workflowId) => ({
      workflowId,
      name: `Workflow ${workflowId}`,
      triggerConditions: {},
      steps: [],
    })),
  );
  return new RecipeExecutor(registry);
}

test("RecipeExecutor.execute fails closed when workflow registry is unavailable", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_missing_registry",
    domainId: "coding",
    defaultWorkflowId: "wf_missing",
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, false);
  assert.equal(result.error, "Workflow wf_missing is not available in the registry.");
});

test("RecipeExecutor.execute fails when workflow is absent from registry", async () => {
  const executor = createExecutor(["wf_available"]);
  const recipe = createRecipe({
    recipeId: "recipe_missing_workflow",
    domainId: "coding",
    defaultWorkflowId: "wf_missing",
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, false);
  assert.equal(result.error, "Workflow wf_missing is not available in the registry.");
});

test("RecipeExecutor.execute succeeds when workflow exists in registry", async () => {
  const executor = createExecutor(["wf_primary"]);
  const recipe = createRecipe({
    recipeId: "recipe_valid_wf",
    domainId: "coding",
    defaultWorkflowId: "wf_primary",
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.equal(result.workflowId, "wf_primary");
});

test("RecipeExecutor.execute relies on registry instead of nonexistent-prefix stub logic", async () => {
  const executor = createExecutor(["nonexistent_workflow"]);
  const recipe = createRecipe({
    recipeId: "recipe_registered_nonexistent_name",
    domainId: "coding",
    defaultWorkflowId: "nonexistent_workflow",
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.equal(result.workflowId, "nonexistent_workflow");
});

test("RecipeExecutor.execute preserves execution context values and tool bundles", async () => {
  const executor = createExecutor(["wf_context"]);
  const recipe = createRecipe({
    recipeId: "recipe_context_test",
    domainId: "coding",
    defaultWorkflowId: "wf_context",
    defaultToolBundleIds: ["bundle_a", "bundle_b"],
  });
  const context = createContext({
    executionId: "exec_context_123",
    taskId: "task_context_456",
    tenantId: "tenant_context_789",
    correlationId: "corr_context_abc",
    input: "Run the context test",
  });

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.equal(result.executionId, context.executionId);
  assert.deepEqual(result.toolBundleIds, ["bundle_a", "bundle_b"]);
  assert.equal(result.output?.taskId, context.taskId);
  assert.equal(result.output?.tenantId, context.tenantId);
  assert.equal(result.output?.correlationId, context.correlationId);
  assert.equal(result.output?.input, context.input);
});

test("RecipeExecutor.execute handles invalid recipe gracefully", async () => {
  const executor = new RecipeExecutor();
  const invalidRecipe = {
    recipeId: "",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  } as DomainRecipe;

  const result = await executor.execute(invalidRecipe, createContext());

  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
  assert.ok(result.recipeId === "unknown_recipe" || result.recipeId === "");
});

test("RecipeExecutor.execute handles minimal recipe when workflow is registered", async () => {
  const executor = createExecutor(["wf_minimal"]);
  const recipe = DomainRecipeSchema.parse({
    recipeId: "recipe_minimal",
    domainId: "coding",
    name: "Minimal Recipe",
    description: "A minimal recipe for testing",
    triggerPhrases: ["minimal recipe"],
    risk_profile_ref: "coding.risk",
    guardrail_overlay: "coding.guardrails",
    default_prompt_bundle_ref: "coding.prompts",
    acceptance_checklist_ref: "coding.acceptance",
    defaultWorkflowId: "wf_minimal",
    defaultToolBundleIds: [],
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.equal(result.recipeId, "recipe_minimal");
});

test("RecipeExecutor.execute supports concurrent executions against a registered workflow", async () => {
  const executor = createExecutor(["wf_concurrent"]);
  const recipe = createRecipe({
    recipeId: "recipe_concurrent_test",
    domainId: "coding",
    defaultWorkflowId: "wf_concurrent",
  });

  const contexts = Array.from({ length: 6 }, (_, index) =>
    createContext({ executionId: `exec_concurrent_${index}` }),
  );

  const results = await Promise.all(contexts.map((context) => executor.execute(recipe, context)));

  assert.equal(results.length, 6);
  assert.ok(results.every((result) => result.success === true));
  assert.ok(results.every((result) => result.workflowId === "wf_concurrent"));
});
