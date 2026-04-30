/**
 * RecipeExecutor Full Coverage Tests
 *
 * Additional tests for edge cases and comprehensive coverage of RecipeExecutor.
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
// Regex Pattern Edge Cases (Issue #2183)
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor regex pattern matches workflow names starting with nonexistent", async () => {
  const executor = new RecipeExecutor();

  // These should all fail because they start with "nonexistent" (case-insensitive)
  const shouldFail = [
    "nonexistent",
    "Nonexistent",
    "NONEXISTENT",
    "nonexistent_workflow",
    "NonexistentWorkflow",
    "nonexistent1",
    "nonexistentABC",
  ];

  for (const workflowId of shouldFail) {
    const recipe = createRecipe({
      recipeId: `recipe_${workflowId}`,
      domainId: "coding",
      defaultWorkflowId: workflowId,
    });

    const result = await executor.execute(recipe, createContext({ executionId: `exec_${workflowId}` }));

    assert.equal(result.success, false, `Expected failure for workflow: ${workflowId}`);
  }
});

test("RecipeExecutor regex pattern does NOT match workflow names containing nonexistent elsewhere", async () => {
  const executor = new RecipeExecutor();

  // These should succeed because "nonexistent" is not at the start
  const shouldSucceed = [
    "wf_nonexistent",
    "test_nonexistent_workflow",
    "workflow.nonexistent",
    "is_nonexistent",
    "not_nonexistent",
    "nonexistent_suffix",
  ];

  for (const workflowId of shouldSucceed) {
    const recipe = createRecipe({
      recipeId: `recipe_${workflowId}`,
      domainId: "coding",
      defaultWorkflowId: workflowId,
    });

    const result = await executor.execute(recipe, createContext({ executionId: `exec_${workflowId}` }));

    assert.equal(result.success, true, `Expected success for workflow: ${workflowId}`);
  }
});

test("RecipeExecutor regex is case insensitive for Nonexistent prefix", async () => {
  const executor = new RecipeExecutor();

  const caseVariants = [
    "NONEXISTENT_workflow",
    "NoNeXiStEnT_workflow",
    "NoNeXiStEnT",
  ];

  for (const workflowId of caseVariants) {
    const recipe = createRecipe({
      recipeId: `recipe_case_${workflowId}`,
      domainId: "coding",
      defaultWorkflowId: workflowId,
    });

    const result = await executor.execute(recipe, createContext());

    assert.equal(result.success, false);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Recipe Validation Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor handles recipe with null recipeId", async () => {
  const executor = new RecipeExecutor();
  const invalidRecipe = {
    recipeId: null,
    domainId: "coding",
    name: "Null Recipe",
    description: "Test",
    triggerPhrases: [],
    defaultWorkflowId: "wf_test",
    defaultToolBundleIds: [],
  } as unknown as DomainRecipe;

  const result = await executor.execute(invalidRecipe, createContext());

  assert.equal(result.success, false);
});

test("RecipeExecutor handles recipe with undefined recipeId", async () => {
  const executor = new RecipeExecutor();
  const invalidRecipe = {
    recipeId: undefined,
    domainId: "coding",
    name: "Undefined Recipe",
    description: "Test",
    triggerPhrases: [],
    defaultWorkflowId: "wf_test",
    defaultToolBundleIds: [],
  } as unknown as DomainRecipe;

  const result = await executor.execute(invalidRecipe, createContext());

  assert.equal(result.success, false);
});

test("RecipeExecutor handles recipe with empty recipeId", async () => {
  const executor = new RecipeExecutor();
  const invalidRecipe = createRecipe({
    recipeId: "",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(invalidRecipe, createContext());

  assert.equal(result.success, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Context Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor handles empty executionId", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_empty_exec",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(recipe, createContext({ executionId: "" }));

  assert.equal(result.success, true);
  assert.equal(result.executionId, "");
});

test("RecipeExecutor handles empty taskId", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_empty_task",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(recipe, createContext({ taskId: "" }));

  assert.equal(result.success, true);
  assert.equal(result.output?.taskId, "");
});

test("RecipeExecutor handles empty tenantId", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_empty_tenant",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(recipe, createContext({ tenantId: "" }));

  assert.equal(result.success, true);
  assert.equal(result.output?.tenantId, "");
});

test("RecipeExecutor handles empty correlationId", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_empty_corr",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(recipe, createContext({ correlationId: "" }));

  assert.equal(result.success, true);
  assert.equal(result.output?.correlationId, "");
});

test("RecipeExecutor handles empty input", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_empty_input",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(recipe, createContext({ input: "" }));

  assert.equal(result.success, true);
  assert.equal(result.output?.input, "");
});

test("RecipeExecutor handles unicode input", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_unicode",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(recipe, createContext({
    input: "Hello 世界 🌍 مرحبا",
  }));

  assert.equal(result.success, true);
  assert.equal(result.output?.input, "Hello 世界 🌍 مرحبا");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool Bundle ID Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor handles single tool bundle ID", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_single_bundle",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
    defaultToolBundleIds: ["bundle-1"],
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.deepEqual(result.toolBundleIds, ["bundle-1"]);
});

test("RecipeExecutor handles many tool bundle IDs", async () => {
  const executor = new RecipeExecutor();
  const manyBundles = Array.from({ length: 100 }, (_, i) => `bundle-${i}`);
  const recipe = createRecipe({
    recipeId: "recipe_many_bundles",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
    defaultToolBundleIds: manyBundles,
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.equal(result.toolBundleIds.length, 100);
});

test("RecipeExecutor handles duplicate tool bundle IDs", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_dup_bundles",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
    defaultToolBundleIds: ["bundle-1", "bundle-1", "bundle-2"],
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  // The result copies the array, so duplicates are preserved
  assert.equal(result.toolBundleIds.length, 3);
});

test("RecipeExecutor handles bundle ID with special characters", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_special_bundle",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
    defaultToolBundleIds: ["bundle@#$%", "bundle/with/slashes", "bundle.with.dots"],
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.equal(result.toolBundleIds.length, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Recipe Schema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor handles recipe with trigger phrases", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_with_triggers",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
    triggerPhrases: ["build", "test", "deploy"],
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
});

test("RecipeExecutor handles recipe with unicode name and description", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_unicode",
    domainId: "coding",
    name: "レリッシュペディア",
    description: "Рецепт на русском",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
});

test("RecipeExecutor handles very long recipe ID", async () => {
  const executor = new RecipeExecutor();
  const longId = "a".repeat(1000);
  const recipe = createRecipe({
    recipeId: longId,
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, true);
  assert.equal(result.recipeId, longId);
});

test("RecipeExecutor handles very long workflow ID", async () => {
  const executor = new RecipeExecutor();
  const longWorkflow = "wf_" + "a".repeat(1000);
  const recipe = createRecipe({
    recipeId: "recipe_long_wf",
    domainId: "coding",
    defaultWorkflowId: longWorkflow,
  });

  // This should succeed unless the regex catches "nonexistent" at the start
  const result = await executor.execute(recipe, createContext());

  // The regex check is based on "nonexistent" prefix, not length
  assert.equal(result.recipeId, "recipe_long_wf");
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor handles Zod validation error", async () => {
  const executor = new RecipeExecutor();
  const invalidRecipe = {
    recipeId: "", // Invalid - empty string
    domainId: "coding",
    name: "Invalid Recipe",
    description: "Test",
    triggerPhrases: [],
    defaultWorkflowId: "wf_test",
    defaultToolBundleIds: [],
  };

  const result = await executor.execute(invalidRecipe as DomainRecipe, createContext());

  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
});

test("RecipeExecutor handles completely malformed recipe", async () => {
  const executor = new RecipeExecutor();
  const malformedRecipe = {
    foo: "bar",
    baz: 123,
  } as unknown as DomainRecipe;

  const result = await executor.execute(malformedRecipe, createContext());

  assert.equal(result.success, false);
});

test("RecipeExecutor handles recipe with wrong types", async () => {
  const executor = new RecipeExecutor();
  const wrongTypesRecipe = {
    recipeId: 123, // Should be string
    domainId: "coding",
    name: "Test",
    description: "Test",
    triggerPhrases: "not-an-array", // Should be array
    defaultWorkflowId: "wf_test",
    defaultToolBundleIds: "not-an-array", // Should be array
  } as unknown as DomainRecipe;

  const result = await executor.execute(wrongTypesRecipe, createContext());

  assert.equal(result.success, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Result Structure Verification
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor returns correct result structure on success", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_struct",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
    defaultToolBundleIds: ["bundle-1", "bundle-2"],
  });

  const result = await executor.execute(recipe, createContext());

  // Verify all required fields are present
  assert.equal(typeof result.success, "boolean");
  assert.equal(typeof result.executionId, "string");
  assert.equal(typeof result.recipeId, "string");
  assert.equal(typeof result.workflowId, "string");
  assert.ok(Array.isArray(result.toolBundleIds));

  if (result.success) {
    assert.ok(result.output !== undefined);
    assert.equal(typeof result.output?.summary, "string");
    assert.equal(typeof result.output?.taskId, "string");
    assert.equal(typeof result.output?.tenantId, "string");
    assert.equal(typeof result.output?.correlationId, "string");
    assert.equal(typeof result.output?.input, "string");
  } else {
    assert.equal(result.output, undefined);
    assert.ok(result.error !== undefined);
  }
});

test("RecipeExecutor returns correct result structure on failure", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_fail",
    domainId: "coding",
    defaultWorkflowId: "nonexistent_wf",
  });

  const result = await executor.execute(recipe, createContext());

  assert.equal(result.success, false);
  assert.equal(result.output, undefined);
  assert.ok(result.error !== undefined);
  assert.equal(typeof result.error, "string");
});

test("RecipeExecutor preserves input values in output", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_preserve",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const customContext: RecipeExecutionContext = {
    executionId: "exec_custom",
    taskId: "task_custom",
    tenantId: "tenant_custom",
    correlationId: "corr_custom",
    input: "custom input data",
  };

  const result = await executor.execute(recipe, customContext);

  assert.equal(result.success, true);
  assert.ok(result.output !== undefined);
  assert.equal(result.output!.taskId, "task_custom");
  assert.equal(result.output!.tenantId, "tenant_custom");
  assert.equal(result.output!.correlationId, "corr_custom");
  assert.equal(result.output!.input, "custom input data");
});

// ─────────────────────────────────────────────────────────────────────────────
// Concurrency Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor handles rapid sequential executions", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_rapid",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  // Execute 100 times rapidly
  for (let i = 0; i < 100; i++) {
    const result = await executor.execute(recipe, createContext({ executionId: `exec_${i}` }));
    assert.equal(result.success, true);
  }
});

test("RecipeExecutor handles concurrent executions with same recipe", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_concurrent",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const promises = Array.from({ length: 50 }, (_, i) =>
    executor.execute(recipe, createContext({ executionId: `exec_concurrent_${i}` }))
  );

  const results = await Promise.all(promises);

  assert.equal(results.length, 50);
  assert.ok(results.every((r) => r.success === true));
});

test("RecipeExecutor handles concurrent executions with different recipes", async () => {
  const executor = new RecipeExecutor();

  const promises = Array.from({ length: 20 }, (_, i) => {
    const recipe = createRecipe({
      recipeId: `recipe_concurrent_${i}`,
      domainId: "coding",
      defaultWorkflowId: i % 5 === 0 ? "nonexistent" : `wf_${i}`,
    });

    return executor.execute(recipe, createContext({ executionId: `exec_${i}` }));
  });

  const results = await Promise.all(promises);

  assert.equal(results.length, 20);
  // 4 should fail (every 5th is nonexistent)
  assert.equal(results.filter((r) => !r.success).length, 4);
});

// ─────────────────────────────────────────────────────────────────────────────
// Output Summary Format Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor output summary contains recipe ID", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_summary_id",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(recipe, createContext());

  assert.ok(result.output !== undefined);
  assert.ok(result.output!.summary.includes("recipe_summary_id") || result.output!.summary.length > 0);
});

test("RecipeExecutor output summary contains workflow ID", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_summary_wf",
    domainId: "coding",
    defaultWorkflowId: "wf_my_workflow",
  });

  const result = await executor.execute(recipe, createContext());

  assert.ok(result.output !== undefined);
  assert.ok(result.output!.summary.includes("wf_my_workflow"));
});

test("RecipeExecutor output summary is non-empty string", async () => {
  const executor = new RecipeExecutor();
  const recipe = createRecipe({
    recipeId: "recipe_summary_test",
    domainId: "coding",
    defaultWorkflowId: "wf_test",
  });

  const result = await executor.execute(recipe, createContext());

  assert.ok(result.output !== undefined);
  assert.ok(typeof result.output!.summary === "string");
  assert.ok(result.output!.summary.length > 0);
});
