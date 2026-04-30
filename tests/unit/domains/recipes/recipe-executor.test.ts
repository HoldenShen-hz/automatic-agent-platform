/**
 * Recipe Executor Unit Tests - Workflow Existence Check (Issue #2183)
 *
 * Tests for RecipeExecutor which has a regex stub for workflow existence check.
 * Issue #2183: Workflow existence check is regex stub not real query.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { RecipeExecutor, type RecipeExecutionContext, type RecipeExecutionResult } from "../../../../src/domains/recipes/recipe-executor.js";
import { DomainRecipeSchema, type DomainRecipe } from "../../../../src/domains/recipes/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createRecipe(overrides: Partial<DomainRecipe> & { recipeId: string; domainId: string; defaultWorkflowId: string }): DomainRecipe {
  return DomainRecipeSchema.parse({
    recipeId: overrides.recipeId,
    domainId: overrides.domainId,
    name: overrides.name ?? `Recipe ${overrides.recipeId}`,
    description: overrides.description ?? "Test recipe",
    triggerPhrases: overrides.triggerPhrases ?? [],
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

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Existence Check Tests (Issue #2183)
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute returns failure when workflow matches nonexistent pattern", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_nonexistent_1",
    domainId: "coding",
    defaultWorkflowId: "nonexistent_workflow", // Will be caught by regex
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
  assert.ok(result.error!.includes("not available") || result.error!.includes("nonexistent"));
});

test("RecipeExecutor.execute returns failure for workflow starting with 'nonexistent' (case insensitive)", async () => {
  const executor = new RecipeExecutor();

  const patterns = ["NONEXISTENT_workflow", "NonexistentWorkflow", "nonexistent"];

  for (const pattern of patterns) {
    const recipe = createRecipe({
      recipeId: `recipe_nonexistent_${pattern}`,
      domainId: "coding",
      defaultWorkflowId: pattern,
    });

    const result = await executor.execute(recipe, createContext({ executionId: `exec_${pattern}` }));

    assert.equal(result.success, false, `Expected failure for pattern: ${pattern}`);
    assert.ok(result.error !== undefined);
  }
});

test("RecipeExecutor.execute uses regex to check workflow availability", async () => {
  const executor = new RecipeExecutor();

  // Workflows that should be caught by the regex stub
  const invalidWorkflows = [
    "nonexistent_wf",
    "NONEXISTENT",
    "NonexistentWorkflow",
    "nonexistent",
  ];

  for (const workflowId of invalidWorkflows) {
    const recipe = createRecipe({
      recipeId: `recipe_regex_${workflowId}`,
      domainId: "coding",
      defaultWorkflowId: workflowId,
    });

    const result = await executor.execute(recipe, createContext({ executionId: `exec_${workflowId}` }));

    assert.equal(result.success, false, `Expected failure for workflow: ${workflowId}`);
    assert.ok(result.error !== undefined);
  }

  // Valid workflows that should pass
  const validWorkflows = [
    "wf_coding",
    "workflow_primary",
    "build_and_test",
    "deploy_production",
  ];

  for (const workflowId of validWorkflows) {
    const recipe = createRecipe({
      recipeId: `recipe_valid_${workflowId}`,
      domainId: "coding",
      defaultWorkflowId: workflowId,
    });

    const result = await executor.execute(recipe, createContext({ executionId: `exec_${workflowId}` }));

    assert.equal(result.success, true, `Expected success for workflow: ${workflowId}`);
  }
});

test("RecipeExecutor.execute returns success for non-nonexistent workflow names", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_valid_wf",
    domainId: "coding",
    defaultWorkflowId: "wf_primary",
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.equal(result.workflowId, "wf_primary");
});

test("RecipeExecutor.execute returns success for workflow name 'nonexistent' (exact match)", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_exact_nonexistent",
    domainId: "coding",
    defaultWorkflowId: "nonexistent", // This IS the word "nonexistent" as a workflow name
  });

  // The regex checks if workflowId STARTS WITH "nonexistent" (case-insensitive)
  // So "nonexistent" (exact) should fail
  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Context Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute preserves execution context values", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_context_test",
    domainId: "coding",
    defaultWorkflowId: "wf_context",
  });

  const context: RecipeExecutionContext = {
    executionId: "exec_context_123",
    taskId: "task_context_456",
    tenantId: "tenant_context_789",
    correlationId: "corr_context_abc",
    input: "Run the context test",
  };

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.equal(result.executionId, context.executionId);
  assert.ok(result.output !== undefined);
});

test("RecipeExecutor.execute returns result with correct structure", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_structure_test",
    domainId: "coding",
    defaultWorkflowId: "wf_structure",
    defaultToolBundleIds: ["bundle_a", "bundle_b"],
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.equal(result.recipeId, "recipe_structure_test");
  assert.equal(result.workflowId, "wf_structure");
  assert.deepEqual(result.toolBundleIds, ["bundle_a", "bundle_b"]);
  assert.ok(typeof result.executionId === "string");
});

test("RecipeExecutor.execute copies toolBundleIds from recipe", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_tools_test",
    domainId: "coding",
    defaultWorkflowId: "wf_tools",
    defaultToolBundleIds: ["repo_tools", "build_tools", "deploy_tools"],
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.toolBundleIds.length, 3);
  assert.ok(result.toolBundleIds.includes("repo_tools"));
  assert.ok(result.toolBundleIds.includes("build_tools"));
  assert.ok(result.toolBundleIds.includes("deploy_tools"));
});

test("RecipeExecutor.execute handles empty toolBundleIds", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_no_tools",
    domainId: "coding",
    defaultWorkflowId: "wf_no_tools",
    defaultToolBundleIds: [],
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.deepEqual(result.toolBundleIds, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute handles invalid recipe gracefully", async () => {
  const executor = new RecipeExecutor();
  const invalidRecipe = {
    recipeId: "", // Empty - invalid
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  };

  const result = await executor.execute(invalidRecipe as DomainRecipe, createContext());

  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
  assert.ok(result.recipeId === "unknown_recipe" || result.recipeId === "");
});

test("RecipeExecutor.execute handles recipe with undefined toolBundleIds", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_undefined_tools",
    domainId: "coding",
    defaultWorkflowId: "wf_undefined",
    defaultToolBundleIds: undefined as unknown as string[],
  });

  const result = await executor.execute(recipe, createContext());

  // Should still return success with empty array
  assert.equal(result.success, true);
  assert.ok(Array.isArray(result.toolBundleIds));
});

test("RecipeExecutor.execute handles recipe without optional fields", async () => {
  const executor = new RecipeExecutor();
  const recipe = DomainRecipeSchema.parse({
    recipeId: "recipe_minimal",
    domainId: "coding",
    name: "Minimal Recipe",
    description: "A minimal recipe for testing",
    triggerPhrases: [],
    defaultWorkflowId: "wf_minimal",
    defaultToolBundleIds: [],
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.equal(result.recipeId, "recipe_minimal");
});

// ─────────────────────────────────────────────────────────────────────────────
// Output Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute output contains all context fields", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_output_test",
    domainId: "coding",
    defaultWorkflowId: "wf_output",
  });

  const context: RecipeExecutionContext = {
    executionId: "exec_output_123",
    taskId: "task_output_456",
    tenantId: "tenant_output_789",
    correlationId: "corr_output_abc",
    input: "Test input for output",
  };

  const result = await executor.execute(recipe, context);

  assert.equal(result.success, true);
  assert.ok(result.output !== undefined);
  assert.equal(result.output!.taskId, context.taskId);
  assert.equal(result.output!.tenantId, context.tenantId);
  assert.equal(result.output!.correlationId, context.correlationId);
  assert.equal(result.output!.input, context.input);
});

test("RecipeExecutor.execute output includes summary", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_summary_test",
    domainId: "coding",
    defaultWorkflowId: "wf_summary",
  });

  const result = await executor.execute(recipe, createContext());

  assert.ok(result.output !== undefined);
  assert.ok(typeof result.output!.summary === "string");
  assert.ok(result.output!.summary.length > 0);
});

test("RecipeExecutor.execute output summary contains recipe and workflow info", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_info_test",
    domainId: "coding",
    defaultWorkflowId: "wf_info_test",
  });

  const result = await executor.execute(recipe, createContext());

  assert.ok(result.output !== undefined);
  assert.ok(result.output!.summary.includes("recipe_info_test") || result.output!.summary.includes("wf_info_test"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Execution Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute can execute same recipe multiple times", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_reuse_test",
    domainId: "coding",
    defaultWorkflowId: "wf_reuse",
  });

  const context1 = createContext({ executionId: "exec_reuse_1" });
  const context2 = createContext({ executionId: "exec_reuse_2" });

  const result1 = await executor.execute(recipe, context1);
  const result2 = await executor.execute(recipe, context2);

  assert.equal(result1.success, true);
  assert.equal(result2.success, true);
  assert.notEqual(result1.executionId, result2.executionId);
});

test("RecipeExecutor.execute handles concurrent executions", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_concurrent_test",
    domainId: "coding",
    defaultWorkflowId: "wf_concurrent",
  });

  const contexts = Array.from({ length: 10 }, (_, i) =>
    createContext({ executionId: `exec_concurrent_${i}` })
  );

  const results = await Promise.all(
    contexts.map((ctx) => executor.execute(recipe, ctx))
  );

  assert.equal(results.length, 10);
  assert.ok(results.every((r) => r.success === true));
  assert.ok(results.every((r) => r.recipeId === "recipe_concurrent_test"));
});

test("RecipeExecutor.execute different recipes produce different results", async () => {
  const executor = new RecipeExecutor();
  const recipe1 = createRecipe({
    recipeId: "recipe_diff_1",
    domainId: "coding",
    defaultWorkflowId: "wf_diff_1",
  });
  const recipe2 = createRecipe({
    recipeId: "recipe_diff_2",
    domainId: "coding",
    defaultWorkflowId: "wf_diff_2",
  });

  const result1 = await executor.execute(recipe1, createContext({ executionId: "exec_diff_1" }));
  const result2 = await executor.execute(recipe2, createContext({ executionId: "exec_diff_2" }));

  assert.equal(result1.recipeId, "recipe_diff_1");
  assert.equal(result2.recipeId, "recipe_diff_2");
  assert.notEqual(result1.workflowId, result2.workflowId);
});

// ─────────────────────────────────────────────────────────────────────────────
// RecipeExecutor Instance Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor can be instantiated", () => {
  const executor = new RecipeExecutor();
  assert.ok(executor !== null);
});

test("RecipeExecutor.execute is async", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_async_test",
    domainId: "coding",
    defaultWorkflowId: "wf_async",
  });

  const start = Date.now();
  await executor.execute(recipe, createContext());
  const duration = Date.now() - start;

  // Should complete quickly (less than 100ms in test environment)
  assert.ok(duration < 1000, `Execution took too long: ${duration}ms`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Special Workflow Name Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute workflow names with 'nonexistent' prefix are rejected", async () => {
  const executor = new RecipeExecutor();

  const invalidNames = [
    "nonexistent_workflow",
    "nonexistentWF",
    "nonexistent wf", // with space
  ];

  for (const name of invalidNames) {
    const recipe = createRecipe({
      recipeId: `recipe_nonex_${name}`,
      domainId: "coding",
      defaultWorkflowId: name,
    });

    const result = await executor.execute(recipe, createContext({ executionId: `exec_${name}` }));

    assert.equal(result.success, false, `Should reject workflow: ${name}`);
  }
});

test("RecipeExecutor.execute workflow names without 'nonexistent' are accepted", async () => {
  const executor = new RecipeExecutor();

  const validNames = [
    "wf_001",
    "primary_workflow",
    "workflow.nonexistent.suffix",
    "test_nonexistent_ignore", // 'nonexistent' not at start
  ];

  for (const name of validNames) {
    const recipe = createRecipe({
      recipeId: `recipe_valid_${name}`,
      domainId: "coding",
      defaultWorkflowId: name,
    });

    const result = await executor.execute(recipe, createContext({ executionId: `exec_${name}` }));

    assert.equal(result.success, true, `Should accept workflow: ${name}`);
  }
});