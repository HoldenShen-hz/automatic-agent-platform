import assert from "node:assert/strict";
import test from "node:test";

import {
  RecipeExecutor,
  type RecipeExecutionContext,
  type RecipeExecutionMetrics,
  type RecipeMetricsCollector,
} from "../../../../src/domains/recipes/recipe-executor.js";
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
    recommended_workflow_ids: overrides.recommended_workflow_ids ?? [overrides.defaultWorkflowId],
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

function createExecutor(workflowIds: readonly string[], metricsCollector?: RecipeMetricsCollector): RecipeExecutor {
  const registry = new WorkflowRegistry();
  registry.registerAll(
    workflowIds.map((workflowId) => ({
      workflowId,
      name: `Workflow ${workflowId}`,
      triggerConditions: {},
      steps: [],
    })),
  );
  return new RecipeExecutor(registry, metricsCollector ? { metricsCollector } : undefined);
}

class RecordingMetricsCollector implements RecipeMetricsCollector {
  public readonly records: RecipeExecutionMetrics[] = [];

  public recordExecution(metrics: RecipeExecutionMetrics): void {
    this.records.push(metrics);
  }
}

test("RecipeExecutor.execute preserves empty context values for registered workflows", async () => {
  const executor = createExecutor(["wf_empty_context"]);
  const recipe = createRecipe({
    recipeId: "recipe_empty_context",
    domainId: "coding",
    defaultWorkflowId: "wf_empty_context",
  });

  const result = await executor.execute(recipe, createContext({
    executionId: "",
    taskId: "",
    tenantId: "",
    correlationId: "",
    input: "",
  }));

  assert.equal(result.success, true);
  assert.equal(result.executionId, "");
  assert.equal(result.output?.taskId, "");
  assert.equal(result.output?.tenantId, "");
  assert.equal(result.output?.correlationId, "");
  assert.equal(result.output?.input, "");
});

test("RecipeExecutor.execute supports unicode and long workflow identifiers when registered", async () => {
  const workflowId = "wf_" + "多语言".repeat(20);
  const executor = createExecutor([workflowId]);
  const recipe = createRecipe({
    recipeId: "recipe_unicode",
    domainId: "coding",
    name: "レシピ",
    description: "Рецепт",
    defaultWorkflowId: workflowId,
  });

  const result = await executor.execute(recipe, createContext({
    input: "Hello 世界 🌍 مرحبا",
  }));

  assert.equal(result.success, true);
  assert.equal(result.workflowId, workflowId);
  assert.equal(result.output?.input, "Hello 世界 🌍 مرحبا");
});

test("RecipeExecutor.execute preserves large tool bundle lists", async () => {
  const executor = createExecutor(["wf_many_bundles"]);
  const toolBundleIds = Array.from({ length: 100 }, (_, index) => `bundle-${index}`);
  const recipe = createRecipe({
    recipeId: "recipe_many_bundles",
    domainId: "coding",
    defaultWorkflowId: "wf_many_bundles",
    defaultToolBundleIds: toolBundleIds,
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.equal(result.toolBundleIds.length, 100);
  assert.deepEqual(result.toolBundleIds, toolBundleIds);
});

test("RecipeExecutor.execute records metrics for successful executions", async () => {
  const metricsCollector = new RecordingMetricsCollector();
  const executor = createExecutor(["wf_metrics_success"], metricsCollector);
  const recipe = createRecipe({
    recipeId: "recipe_metrics_success",
    domainId: "coding",
    defaultWorkflowId: "wf_metrics_success",
  });

  const result = await executor.execute(recipe, createContext({ executionId: "exec_metrics_success" }));

  assert.equal(result.success, true);
  assert.equal(metricsCollector.records.length, 1);
  assert.equal(metricsCollector.records[0]?.executionId, "exec_metrics_success");
  assert.equal(metricsCollector.records[0]?.success, true);
  assert.equal(metricsCollector.records[0]?.workflowId, "wf_metrics_success");
});

test("RecipeExecutor.execute records metrics for registry lookup failures", async () => {
  const metricsCollector = new RecordingMetricsCollector();
  const executor = createExecutor(["wf_available"], metricsCollector);
  const recipe = createRecipe({
    recipeId: "recipe_metrics_failure",
    domainId: "coding",
    defaultWorkflowId: "wf_missing",
  });

  const result = await executor.execute(recipe, createContext({ executionId: "exec_metrics_failure" }));

  assert.equal(result.success, false);
  assert.equal(metricsCollector.records.length, 1);
  assert.equal(metricsCollector.records[0]?.executionId, "exec_metrics_failure");
  assert.equal(metricsCollector.records[0]?.success, false);
  assert.equal(metricsCollector.records[0]?.workflowId, "wf_missing");
});

test("RecipeExecutor.execute rejects malformed recipes before reporting success", async () => {
  const executor = new RecipeExecutor();
  const malformedRecipe = {
    foo: "bar",
    baz: 123,
  } as unknown as DomainRecipe;

  const result = await executor.execute(malformedRecipe, createContext());

  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
});
