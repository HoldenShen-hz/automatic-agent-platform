/**
 * RecipeExecutor Unit Tests
 *
 * Tests for:
 * - Recipe execution with workflow and tool bundles
 * - Execution context and parameters
 * - Success and failure handling
 * - Tool bundle integration
 */

// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { DomainRecipeSchema } from "../../../../src/domains/recipes/index.js";
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

interface ExecutionResult {
  success: boolean;
  executionId: string;
  recipeId: string;
  workflowId: string;
  toolBundleIds: string[];
  output?: unknown;
  error?: string;
}

interface ExecutionContext {
  executionId: string;
  taskId: string;
  tenantId: string;
  correlationId: string;
  input: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Construction & Basic Execution Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor is constructed without errors", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();

  assert.ok(executor !== null);
});

test("RecipeExecutor.execute runs a recipe and returns execution result", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_exec",
    domainId: "coding",
    defaultWorkflowId: "wf_coding",
    defaultToolBundleIds: ["repo_tools", "build_tools"],
  });

  const context: ExecutionContext = {
    executionId: "exec_123",
    taskId: "task_456",
    tenantId: "tenant_789",
    correlationId: "corr_abc",
    input: "write a function to calculate fibonacci",
  };

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.equal(result.recipeId, recipe.recipeId);
  assert.equal(result.workflowId, recipe.defaultWorkflowId);
  assert.deepEqual(result.toolBundleIds, recipe.defaultToolBundleIds);
  assert.ok(result.executionId !== undefined);
});

test("RecipeExecutor.execute includes all tool bundle ids from recipe", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_tools",
    domainId: "coding",
    defaultWorkflowId: "wf_tools",
    defaultToolBundleIds: ["bundle_a", "bundle_b", "bundle_c"],
  });

  const context: ExecutionContext = {
    executionId: "exec_tools",
    taskId: "task_tools",
    tenantId: "tenant",
    correlationId: "corr_tools",
    input: "deploy to production",
  };

  const result = await executor.execute(recipe, context);

  assert.equal(result.toolBundleIds.length, 3);
  assert.ok(result.toolBundleIds.includes("bundle_a"));
  assert.ok(result.toolBundleIds.includes("bundle_b"));
  assert.ok(result.toolBundleIds.includes("bundle_c"));
});

test("RecipeExecutor.execute with empty tool bundle ids", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_no_tools",
    domainId: "data",
    defaultWorkflowId: "wf_data",
    defaultToolBundleIds: [],
  });

  const context: ExecutionContext = {
    executionId: "exec_no_tools",
    taskId: "task_no_tools",
    tenantId: "tenant",
    correlationId: "corr_no_tools",
    input: "analyze this",
  };

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.equal(result.toolBundleIds.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Context Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute passes execution context correctly", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_context",
    domainId: "coding",
    defaultWorkflowId: "wf_context",
  });

  const context: ExecutionContext = {
    executionId: "exec_context",
    taskId: "task_context",
    tenantId: "tenant_context",
    correlationId: "corr_context",
    input: "context test input",
  };

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.equal(result.executionId, context.executionId);
});

test("RecipeExecutor.execute uses recipe's defaultWorkflowId", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_workflow",
    domainId: "coding",
    defaultWorkflowId: "my_custom_workflow",
  });

  const context: ExecutionContext = {
    executionId: "exec_workflow",
    taskId: "task_workflow",
    tenantId: "tenant",
    correlationId: "corr_workflow",
    input: "run workflow",
  };

  const result = await executor.execute(recipe, context);

  assert.equal(result.workflowId, "my_custom_workflow");
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute returns failure result on workflow error", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_error",
    domainId: "coding",
    defaultWorkflowId: "nonexistent_workflow",
  });

  const context: ExecutionContext = {
    executionId: "exec_error",
    taskId: "task_error",
    tenantId: "tenant",
    correlationId: "corr_error",
    input: "trigger error",
  };

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
  assert.ok(result.error!.length > 0);
});

test("RecipeExecutor.execute returns failure when recipe is invalid", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();

  // Create a recipe with empty required field to trigger validation error
  const invalidRecipe = {
    recipeId: "",
    domainId: "coding",
    defaultWorkflowId: "wf_1",
  };

  const context: ExecutionContext = {
    executionId: "exec_invalid",
    taskId: "task_invalid",
    tenantId: "tenant",
    correlationId: "corr_invalid",
    input: "test",
  };

  const result = await executor.execute(invalidRecipe as DomainRecipe, context);

  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Result Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute returns result with all required fields", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_result",
    domainId: "coding",
    defaultWorkflowId: "wf_result",
    defaultToolBundleIds: ["tools"],
  });

  const context: ExecutionContext = {
    executionId: "exec_result",
    taskId: "task_result",
    tenantId: "tenant_result",
    correlationId: "corr_result",
    input: "test result",
  };

  const result = await executor.execute(recipe, context);

  assert.ok(typeof result.success === "boolean");
  assert.ok(typeof result.executionId === "string");
  assert.ok(typeof result.recipeId === "string");
  assert.ok(typeof result.workflowId === "string");
  assert.ok(Array.isArray(result.toolBundleIds));
});

test("RecipeExecutor.execute output contains execution artifacts", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_output",
    domainId: "coding",
    defaultWorkflowId: "wf_output",
    defaultToolBundleIds: [],
  });

  const context: ExecutionContext = {
    executionId: "exec_output",
    taskId: "task_output",
    tenantId: "tenant",
    correlationId: "corr_output",
    input: "produce output",
  };

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.ok(result.output !== undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Execution Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute can run same recipe multiple times", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_reuse",
    domainId: "coding",
    defaultWorkflowId: "wf_reuse",
  });

  const context1: ExecutionContext = {
    executionId: "exec_reuse_1",
    taskId: "task_reuse_1",
    tenantId: "tenant",
    correlationId: "corr_reuse_1",
    input: "first execution",
  };

  const context2: ExecutionContext = {
    executionId: "exec_reuse_2",
    taskId: "task_reuse_2",
    tenantId: "tenant",
    correlationId: "corr_reuse_2",
    input: "second execution",
  };

  const result1 = await executor.execute(recipe, context1);
  const result2 = await executor.execute(recipe, context2);

  assert.equal(result1.success, true);
  assert.equal(result2.success, true);
  assert.notEqual(result1.executionId, result2.executionId);
});

test("RecipeExecutor.execute handles concurrent executions", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_concurrent",
    domainId: "coding",
    defaultWorkflowId: "wf_concurrent",
  });

  const contexts = Array.from({ length: 5 }, (_, i) => ({
    executionId: `exec_concurrent_${i}`,
    taskId: `task_concurrent_${i}`,
    tenantId: "tenant",
    correlationId: `corr_concurrent_${i}`,
    input: `concurrent execution ${i}`,
  }));

  const results = await Promise.all(
    contexts.map((ctx) => executor.execute(recipe, ctx)),
  );

  assert.equal(results.length, 5);
  assert.ok(results.every((r) => r.success === true));
  assert.ok(results.every((r) => r.recipeId === recipe.recipeId));
});

// ─────────────────────────────────────────────────────────────────────────────
// Executor Metadata Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute preserves recipe metadata in result", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_meta",
    domainId: "coding",
    name: "Coding Recipe",
    description: "A recipe for coding tasks",
    defaultWorkflowId: "wf_meta",
  });

  const context: ExecutionContext = {
    executionId: "exec_meta",
    taskId: "task_meta",
    tenantId: "tenant",
    correlationId: "corr_meta",
    input: "test metadata",
  };

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.equal(result.recipeId, "recipe_meta");
});

test("RecipeExecutor returns ExecutionResult type with correct structure", async () => {
  const { RecipeExecutor } = await import("../../../../src/domains/recipes/recipe-executor.js");
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_type",
    domainId: "data",
    defaultWorkflowId: "wf_type",
    defaultToolBundleIds: ["bundle_type"],
  });

  const context: ExecutionContext = {
    executionId: "exec_type",
    taskId: "task_type",
    tenantId: "tenant_type",
    correlationId: "corr_type",
    input: "type test",
  };

  const result = await executor.execute(recipe, context);

  // Verify all expected fields are present
  assert.ok("success" in result);
  assert.ok("executionId" in result);
  assert.ok("recipeId" in result);
  assert.ok("workflowId" in result);
  assert.ok("toolBundleIds" in result);
});
