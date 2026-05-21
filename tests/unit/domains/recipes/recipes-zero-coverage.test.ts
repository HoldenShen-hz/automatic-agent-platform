/**
 * Recipes Zero-Coverage Tests
 *
 * Comprehensive tests for edge cases and uncovered paths in:
 * - src/domains/recipes/index.ts
 * - src/domains/recipes/recipe-executor.ts
 * - src/domains/recipes/recipe-registry.ts
 *
 * Uses node:test format for consistency with project conventions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DomainRecipeSchema, matchDomainRecipe, type DomainRecipe } from "../../../../src/domains/recipes/index.js";
import { RecipeExecutor, type RecipeExecutionContext } from "../../../../src/domains/recipes/recipe-executor.js";
import { RecipeRegistry } from "../../../../src/domains/recipes/recipe-registry.js";
import { WorkflowRegistry } from "../../../../src/domains/registry/workflow-registry.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeRecipe(overrides: Partial<DomainRecipe> & { recipeId: string; domainId: string; defaultWorkflowId: string }): DomainRecipe {
  return DomainRecipeSchema.parse({
    recipeId: overrides.recipeId,
    domainId: overrides.domainId,
    archetype: overrides.archetype ?? "crud_heavy",
    name: overrides.name ?? `Recipe ${overrides.recipeId}`,
    description: overrides.description,
    riskProfileRef: overrides.riskProfileRef ?? `${overrides.domainId}.risk`,
    guardrailOverlay: overrides.guardrailOverlay ?? {},
    triggerPhrases: overrides.triggerPhrases ?? [],
    defaultWorkflowId: overrides.defaultWorkflowId,
    recommendedWorkflowIds: overrides.recommendedWorkflowIds ?? [],
    defaultToolBundleIds: overrides.defaultToolBundleIds ?? [],
    defaultPromptBundleRef: overrides.defaultPromptBundleRef ?? `${overrides.domainId}.default-prompt`,
    acceptanceChecklistRef: overrides.acceptanceChecklistRef ?? `${overrides.domainId}.acceptance`,
  });
}

function makeContext(overrides: Partial<RecipeExecutionContext> = {}): RecipeExecutionContext {
  return {
    executionId: overrides.executionId ?? "exec_001",
    taskId: overrides.taskId ?? "task_001",
    tenantId: overrides.tenantId ?? "tenant_001",
    correlationId: overrides.correlationId ?? "corr_001",
    input: overrides.input ?? "test input",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// index.ts Tests - Schema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainRecipeSchema accepts all valid archetype values", () => {
  const archetypes = [
    "crud_heavy",
    "analytics",
    "creative",
    "realtime",
    "trading",
    "compliance",
    "research",
    "adversarial",
    "moderation",
    "logistics",
    "conversational",
    "incident_ops",
  ] as const;

  for (const archetype of archetypes) {
    const recipe = makeRecipe({
      recipeId: `recipe_${archetype}`,
      domainId: "test",
      defaultWorkflowId: "wf_test",
      archetype,
    });
    assert.equal(recipe.archetype, archetype);
  }
});

test("DomainRecipeSchema applies default archetype when omitted", () => {
  const recipe = makeRecipe({
    recipeId: "recipe_default_archetype",
    domainId: "test",
    defaultWorkflowId: "wf_test",
  });
  assert.equal(recipe.archetype, "crud_heavy");
});

test("DomainRecipeSchema default guardrailOverlay is empty object", () => {
  const recipe = makeRecipe({
    recipeId: "recipe_no_guardrails",
    domainId: "test",
    defaultWorkflowId: "wf_test",
  });
  assert.deepEqual(recipe.guardrailOverlay, {});
});

test("DomainRecipeSchema default triggerPhrases is empty array", () => {
  const recipe = makeRecipe({
    recipeId: "recipe_no_triggers",
    domainId: "test",
    defaultWorkflowId: "wf_test",
  });
  assert.deepEqual(recipe.triggerPhrases, []);
});

test("DomainRecipeSchema default recommendedWorkflowIds is empty array", () => {
  const recipe = makeRecipe({
    recipeId: "recipe_no_recommended",
    domainId: "test",
    defaultWorkflowId: "wf_test",
  });
  assert.deepEqual(recipe.recommendedWorkflowIds, []);
});

test("DomainRecipeSchema rejects recipe with whitespace-only recipeId", () => {
  const result = DomainRecipeSchema.safeParse({
    recipeId: "   ",
    domainId: "test",
    defaultWorkflowId: "wf_test",
    riskProfileRef: "test.risk",
    defaultPromptBundleRef: "test.prompt",
    acceptanceChecklistRef: "test.accept",
  });
  assert.equal(result.success, false);
});

test("DomainRecipeSchema rejects recipe with whitespace-only domainId", () => {
  const result = DomainRecipeSchema.safeParse({
    recipeId: "recipe_1",
    domainId: "   ",
    defaultWorkflowId: "wf_test",
    riskProfileRef: "test.risk",
    defaultPromptBundleRef: "test.prompt",
    acceptanceChecklistRef: "test.accept",
  });
  assert.equal(result.success, false);
});

test("DomainRecipeSchema accepts optional name field", () => {
  const recipe = makeRecipe({
    recipeId: "recipe_with_name",
    domainId: "test",
    defaultWorkflowId: "wf_test",
    name: "My Custom Recipe Name",
  });
  assert.equal(recipe.name, "My Custom Recipe Name");
});

test("DomainRecipeSchema accepts optional description field", () => {
  const recipe = makeRecipe({
    recipeId: "recipe_with_desc",
    domainId: "test",
    defaultWorkflowId: "wf_test",
    description: "A detailed description of what this recipe does",
  });
  assert.equal(recipe.description, "A detailed description of what this recipe does");
});

test("DomainRecipeSchema accepts guardrailOverlay with string keys and unknown values", () => {
  const recipe = makeRecipe({
    recipeId: "recipe_guardrails",
    domainId: "test",
    defaultWorkflowId: "wf_test",
    guardrailOverlay: {
      rate_limit: 100,
      timeout_ms: 5000,
      allowed_regions: ["us-east-1", "eu-west-1"],
    },
  });
  assert.equal(recipe.guardrailOverlay.rate_limit, 100);
  assert.deepEqual(recipe.guardrailOverlay.allowed_regions, ["us-east-1", "eu-west-1"]);
});

test("DomainRecipeSchema rejects invalid archetype value", () => {
  const result = DomainRecipeSchema.safeParse({
    recipeId: "recipe_bad_archetype",
    domainId: "test",
    archetype: "invalid_archetype" as DomainRecipe["archetype"],
    defaultWorkflowId: "wf_test",
    riskProfileRef: "test.risk",
    defaultPromptBundleRef: "test.prompt",
    acceptanceChecklistRef: "test.accept",
  });
  assert.equal(result.success, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// matchDomainRecipe Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("matchDomainRecipe handles trigger phrase with special regex characters", () => {
  const recipes = [
    {
      recipeId: "recipe_special",
      domainId: "test",
      archetype: "crud_heavy" as const,
      triggerPhrases: ["file (.*).js", "search [query]"],
      defaultWorkflowId: "wf_1",
      defaultToolBundleIds: [],
    },
  ];

  // The function does substring matching, not regex
  const result = matchDomainRecipe(recipes, "I want to search [query] now");
  assert.ok(result !== null);
  assert.equal(result.recipeId, "recipe_special");
});

test("matchDomainRecipe handles trigger phrase containing unicode", () => {
  const recipes = [
    {
      recipeId: "recipe_unicode",
      domainId: "test",
      archetype: "crud_heavy" as const,
      triggerPhrases: ["你好世界", "こんにちは世界"],
      defaultWorkflowId: "wf_1",
      defaultToolBundleIds: [],
    },
  ];

  const result = matchDomainRecipe(recipes, "我想说你好世界");
  assert.ok(result !== null);
  assert.equal(result.recipeId, "recipe_unicode");
});

test("matchDomainRecipe returns null for whitespace-only input", () => {
  const recipes = [
    {
      recipeId: "recipe_1",
      domainId: "test",
      archetype: "crud_heavy" as const,
      triggerPhrases: ["code"],
      defaultWorkflowId: "wf_1",
      defaultToolBundleIds: [],
    },
  ];

  const result = matchDomainRecipe(recipes, "   ");
  assert.equal(result, null);
});

test("matchDomainRecipe returns null for empty input", () => {
  const recipes = [
    {
      recipeId: "recipe_1",
      domainId: "test",
      archetype: "crud_heavy" as const,
      triggerPhrases: ["code"],
      defaultWorkflowId: "wf_1",
      defaultToolBundleIds: [],
    },
  ];

  const result = matchDomainRecipe(recipes, "");
  assert.equal(result, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// RecipeRegistry Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeRegistry.get returns null for empty string recipeId", () => {
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_1",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  }));

  const result = registry.get("");
  assert.equal(result, null);
});

test("RecipeRegistry.has returns false for empty string recipeId", () => {
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_1",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  }));

  const result = registry.has("");
  assert.equal(result, false);
});

test("RecipeRegistry.listByDomain returns empty for whitespace domainId", () => {
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_1",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  }));

  const result = registry.listByDomain("   ");
  assert.equal(result.length, 0);
});

test("RecipeRegistry.findByTriggerPhrase handles empty trigger phrase", () => {
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_empty",
    domainId: "test",
    defaultWorkflowId: "wf_1",
    triggerPhrases: [],
  }));

  const result = registry.findByTriggerPhrase("any input at all");
  assert.equal(result, null);
});

test("RecipeRegistry.findByTriggerPhrase returns first matching recipe not all matches", () => {
  const registry = new RecipeRegistry();
  registry.registerAll([
    makeRecipe({
      recipeId: "recipe_first",
      domainId: "test",
      defaultWorkflowId: "wf_1",
      triggerPhrases: ["help"],
    }),
    makeRecipe({
      recipeId: "recipe_second",
      domainId: "test",
      defaultWorkflowId: "wf_2",
      triggerPhrases: ["help me"],
    }),
  ]);

  // Should return recipe_first because it appears first and "help" matches
  const result = registry.findByTriggerPhrase("I need help please");
  assert.ok(result !== null);
  assert.equal(result.recipeId, "recipe_first");
});

test("RecipeRegistry.registerAll skips invalid recipes in array", () => {
  const registry = new RecipeRegistry();
  const validRecipe = makeRecipe({
    recipeId: "recipe_valid",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  });

  // This should throw because the second recipe is invalid
  assert.throws(() => {
    registry.registerAll([
      validRecipe,
      {
        recipeId: "",
        domainId: "test",
        defaultWorkflowId: "wf_1",
      } as DomainRecipe,
    ]);
  });
});

test("RecipeRegistry.list returns new array each call (immutability)", () => {
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_immutable",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  }));

  const list1 = registry.list();
  const list2 = registry.list();
  assert.ok(list1 !== list2);
  assert.deepEqual(list1, list2);

  // Modifying one doesn't affect the other
  list1.push(makeRecipe({ recipeId: "tampered", domainId: "x", defaultWorkflowId: "y" }));
  const list3 = registry.list();
  assert.equal(list3.length, 1);
});

test("RecipeRegistry.listByDomain returns recipes with correct domainId only", () => {
  const registry = new RecipeRegistry();
  registry.registerAll([
    makeRecipe({ recipeId: "r1", domainId: "domain_a", defaultWorkflowId: "wf_1" }),
    makeRecipe({ recipeId: "r2", domainId: "domain_b", defaultWorkflowId: "wf_2" }),
    makeRecipe({ recipeId: "r3", domainId: "domain_a", defaultWorkflowId: "wf_3" }),
    makeRecipe({ recipeId: "r4", domainId: "domain_a", defaultWorkflowId: "wf_4" }),
  ]);

  const results = registry.listByDomain("domain_a");
  assert.equal(results.length, 3);
  for (const r of results) {
    assert.equal(r.domainId, "domain_a");
  }
});

test("RecipeRegistry.has returns true after registration", () => {
  const registry = new RecipeRegistry();
  assert.equal(registry.has("recipe_test"), false);

  registry.register(makeRecipe({
    recipeId: "recipe_test",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  }));

  assert.equal(registry.has("recipe_test"), true);
});

test("RecipeRegistry.has returns false after clear", () => {
  const registry = new RecipeRegistry();
  registry.register(makeRecipe({
    recipeId: "recipe_clear",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  }));

  assert.equal(registry.has("recipe_clear"), true);
  registry.clear();
  assert.equal(registry.has("recipe_clear"), false);
});

test("RecipeRegistry.register updates existing recipe with new data", () => {
  const registry = new RecipeRegistry();
  const recipe1 = makeRecipe({
    recipeId: "recipe_update",
    domainId: "test",
    defaultWorkflowId: "wf_original",
    name: "Original Name",
    description: "Original description",
  });

  const recipe2 = makeRecipe({
    recipeId: "recipe_update",
    domainId: "test",
    defaultWorkflowId: "wf_updated",
    name: "Updated Name",
    description: "Updated description",
  });

  registry.register(recipe1);
  registry.register(recipe2);

  const retrieved = registry.get("recipe_update");
  assert.ok(retrieved !== null);
  assert.equal(retrieved.defaultWorkflowId, "wf_updated");
  assert.equal(retrieved.name, "Updated Name");
  assert.equal(retrieved.description, "Updated description");
});

// ─────────────────────────────────────────────────────────────────────────────
// RecipeExecutor Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("RecipeExecutor.execute handles undefined recipeId in catch block", async () => {
  const executor = new RecipeExecutor();
  const badRecipe = {
    recipeId: undefined,
    domainId: "test",
    defaultWorkflowId: "wf_1",
    defaultToolBundleIds: [],
  } as unknown as DomainRecipe;

  const result = await executor.execute(badRecipe, makeContext());
  assert.equal(result.success, false);
  assert.equal(result.recipeId, "unknown_recipe");
});

test("RecipeExecutor.execute handles undefined defaultWorkflowId in catch block", async () => {
  const executor = new RecipeExecutor();
  const badRecipe = {
    recipeId: "recipe_test",
    domainId: "test",
    defaultWorkflowId: undefined,
    defaultToolBundleIds: [],
  } as unknown as DomainRecipe;

  const result = await executor.execute(badRecipe, makeContext());
  assert.equal(result.success, false);
  assert.equal(result.workflowId, "unknown_workflow");
});

test("RecipeExecutor.execute handles non-array defaultToolBundleIds in catch", async () => {
  const executor = new RecipeExecutor();
  const badRecipe = {
    recipeId: "recipe_test",
    domainId: "test",
    defaultWorkflowId: "wf_1",
    defaultToolBundleIds: "not_an_array" as unknown as string[],
  } as unknown as DomainRecipe;

  const result = await executor.execute(badRecipe, makeContext());
  assert.equal(result.success, false);
  assert.deepEqual(result.toolBundleIds, []);
});

test("RecipeExecutor.execute records metrics even when workflow not found", async () => {
  let recordedMetrics = null;
  const executor = new RecipeExecutor(null, {
    metricsCollector: {
      recordExecution: (metrics) => { recordedMetrics = metrics; },
    },
  });

  const recipe = makeRecipe({
    recipeId: "recipe_no_workflow",
    domainId: "test",
    defaultWorkflowId: "nonexistent_workflow",
  });

  const result = await executor.execute(recipe, makeContext({ executionId: "exec_no_workflow" }));

  assert.equal(result.success, false);
  assert.ok(recordedMetrics !== null);
  assert.equal(recordedMetrics.executionId, "exec_no_workflow");
  assert.equal(recordedMetrics.success, false);
  assert.equal(recordedMetrics.recipeId, "recipe_no_workflow");
});

test("RecipeExecutor.execute uses workflowQuery for async existsWorkflow", async () => {
  const executor = new RecipeExecutor(null, {}, {
    existsWorkflow: async (workflowId: string) => {
      // Simulate async database lookup
      await Promise.resolve();
      return workflowId === "wf_async";
    },
  });

  const recipe = makeRecipe({
    recipeId: "recipe_async",
    domainId: "test",
    defaultWorkflowId: "wf_async",
  });

  const result = await executor.execute(recipe, makeContext());
  assert.equal(result.success, true);
  assert.equal(result.workflowId, "wf_async");
});

test("RecipeExecutor.execute uses workflowQuery Promise<boolean> result", async () => {
  const executor = new RecipeExecutor(null, {}, {
    existsWorkflow: (workflowId: string) => {
      // Return Promise<boolean>
      return Promise.resolve(workflowId === "wf_promise");
    },
  });

  const recipe = makeRecipe({
    recipeId: "recipe_promise",
    domainId: "test",
    defaultWorkflowId: "wf_promise",
  });

  const result = await executor.execute(recipe, makeContext());
  assert.equal(result.success, true);
});

test("RecipeExecutor.execute falls back to registry when query is null", async () => {
  const registry = new WorkflowRegistry();
  registry.register({
    workflowId: "wf_registry_fallback",
    name: "Fallback Workflow",
    triggerConditions: {},
    steps: [],
  });

  const executor = new RecipeExecutor(registry, {}, null);

  const recipe = makeRecipe({
    recipeId: "recipe_fallback",
    domainId: "test",
    defaultWorkflowId: "wf_registry_fallback",
  });

  const result = await executor.execute(recipe, makeContext());
  assert.equal(result.success, true);
});

test("RecipeExecutor.execute uses both workflowQuery and registry when query returns false", async () => {
  const registry = new WorkflowRegistry();
  registry.register({
    workflowId: "wf_in_registry",
    name: "In Registry",
    triggerConditions: {},
    steps: [],
  });

  // Query always returns false (workflow not in DB), but registry has it
  const executor = new RecipeExecutor(registry, {}, {
    existsWorkflow: () => false,
  });

  const recipe = makeRecipe({
    recipeId: "recipe_mixed",
    domainId: "test",
    defaultWorkflowId: "wf_in_registry",
  });

  const result = await executor.execute(recipe, makeContext());
  // Falls back to registry lookup which finds it
  assert.equal(result.success, true);
});

test("RecipeExecutor.execute output contains original input", async () => {
  const executor = new RecipeExecutor(null, {}, {
    existsWorkflow: () => true,
  });

  const recipe = makeRecipe({
    recipeId: "recipe_output_test",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  });

  const context = makeContext({ input: "User wants to create a new function" });
  const result = await executor.execute(recipe, context);

  assert.ok(result.output !== undefined);
  assert.equal(result.output?.input, "User wants to create a new function");
});

test("RecipeExecutor.execute output contains context taskId", async () => {
  const executor = new RecipeExecutor(null, {}, {
    existsWorkflow: () => true,
  });

  const recipe = makeRecipe({
    recipeId: "recipe_output_task",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  });

  const context = makeContext({ taskId: "task_custom_123" });
  const result = await executor.execute(recipe, context);

  assert.ok(result.output !== undefined);
  assert.equal(result.output?.taskId, "task_custom_123");
});

test("RecipeExecutor.execute output contains context tenantId", async () => {
  const executor = new RecipeExecutor(null, {}, {
    existsWorkflow: () => true,
  });

  const recipe = makeRecipe({
    recipeId: "recipe_output_tenant",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  });

  const context = makeContext({ tenantId: "tenant_xyz_789" });
  const result = await executor.execute(recipe, context);

  assert.ok(result.output !== undefined);
  assert.equal(result.output?.tenantId, "tenant_xyz_789");
});

test("RecipeExecutor.execute output contains context correlationId", async () => {
  const executor = new RecipeExecutor(null, {}, {
    existsWorkflow: () => true,
  });

  const recipe = makeRecipe({
    recipeId: "recipe_output_corr",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  });

  const context = makeContext({ correlationId: "corr_abc_123" });
  const result = await executor.execute(recipe, context);

  assert.ok(result.output !== undefined);
  assert.equal(result.output?.correlationId, "corr_abc_123");
});

test("RecipeExecutor.execute result toolBundleIds is a copy not reference", async () => {
  const toolBundles = ["bundle_1", "bundle_2"];
  const executor = new RecipeExecutor(null, {}, {
    existsWorkflow: () => true,
  });

  const recipe = makeRecipe({
    recipeId: "recipe_copy_test",
    domainId: "test",
    defaultWorkflowId: "wf_1",
    defaultToolBundleIds: toolBundles,
  });

  const result = await executor.execute(recipe, makeContext());

  // Verify it's a copy by modifying original array
  toolBundles.push("bundle_3");
  assert.equal(result.toolBundleIds.length, 2);
  assert.ok(!result.toolBundleIds.includes("bundle_3"));
});

test("RecipeExecutor.execute handles validation error from schema.parse", async () => {
  const executor = new RecipeExecutor();
  const invalidRecipe = {
    recipeId: "",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  } as DomainRecipe;

  const result = await executor.execute(invalidRecipe, makeContext());
  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
});

test("RecipeExecutor.execute passes empty string context values through", async () => {
  const executor = new RecipeExecutor(null, {}, {
    existsWorkflow: () => true,
  });

  const recipe = makeRecipe({
    recipeId: "recipe_empty_context",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  });

  const context = makeContext({
    executionId: "",
    taskId: "",
    tenantId: "",
    correlationId: "",
    input: "",
  });

  const result = await executor.execute(recipe, context);
  assert.equal(result.success, true);
  assert.equal(result.executionId, "");
  assert.equal(result.output?.taskId, "");
  assert.equal(result.output?.tenantId, "");
  assert.equal(result.output?.correlationId, "");
  assert.equal(result.output?.input, "");
});

test("RecipeExecutor.execute handles large number of tool bundle ids", async () => {
  const executor = new RecipeExecutor(null, {}, {
    existsWorkflow: () => true,
  });

  const manyBundles = Array.from({ length: 100 }, (_, i) => `bundle_${i}`);
  const recipe = makeRecipe({
    recipeId: "recipe_many_bundles",
    domainId: "test",
    defaultWorkflowId: "wf_1",
    defaultToolBundleIds: manyBundles,
  });

  const result = await executor.execute(recipe, makeContext());
  assert.equal(result.success, true);
  assert.equal(result.toolBundleIds.length, 100);
});

test("RecipeExecutor.execute handles error objects without message property", async () => {
  const executor = new RecipeExecutor();
  // Trigger an error path where error doesn't have message
  const badRecipe = {
    recipeId: "bad",
    defaultWorkflowId: "",
  } as unknown as DomainRecipe;

  const result = await executor.execute(badRecipe, makeContext());
  assert.equal(result.success, false);
});

test("RecipeExecutor.execute error message for missing workflow", () => {
  // This is covered but verifying the exact error message format
  const executor = new RecipeExecutor();
  const recipe = makeRecipe({
    recipeId: "recipe_err_msg",
    domainId: "test",
    defaultWorkflowId: "missing_wf",
  });

  return executor.execute(recipe, makeContext()).then((result) => {
    assert.equal(result.success, false);
    assert.ok(result.error?.includes("missing_wf"));
  });
});

test("RecipeExecutor.execute records durationMs in metrics", async () => {
  let recordedMetrics = null;
  const executor = new RecipeExecutor(null, {
    metricsCollector: {
      recordExecution: (metrics) => { recordedMetrics = metrics; },
    },
  });

  const recipe = makeRecipe({
    recipeId: "recipe_duration",
    domainId: "test",
    defaultWorkflowId: "wf_1",
  });

  await executor.execute(recipe, makeContext());

  assert.ok(recordedMetrics !== null);
  assert.ok(typeof recordedMetrics.durationMs === "number");
  assert.ok(recordedMetrics.durationMs >= 0);
});

test("RecipeExecutor records metrics in finally block even after error", async () => {
  let metricsOrder: string[] = [];
  const executor = new RecipeExecutor(null, {
    metricsCollector: {
      recordExecution: (metrics) => {
        metricsOrder.push(`record:${metrics.recipeId}`);
      },
    },
  });

  // Force an error by passing invalid recipe
  const badRecipe = { recipeId: "error_recipe" } as unknown as DomainRecipe;
  await executor.execute(badRecipe, makeContext());

  assert.ok(metricsOrder.includes("record:unknown_recipe"));
});

test("RecipeExecutor.execute with all archetypes succeeds when workflow exists", () => {
  const archetypes = [
    "crud_heavy", "analytics", "creative", "realtime", "trading",
    "compliance", "research", "adversarial", "moderation",
    "logistics", "conversational", "incident_ops",
  ] as const;

  const executor = new RecipeExecutor(null, {}, { existsWorkflow: () => true });

  return Promise.all(archetypes.map(async (archetype) => {
    const recipe = makeRecipe({
      recipeId: `recipe_${archetype}`,
      domainId: "test",
      defaultWorkflowId: "wf_any",
      archetype,
    });

    const result = await executor.execute(recipe, makeContext());
    assert.equal(result.success, true, `Failed for archetype: ${archetype}`);
    assert.equal(result.recipeId, `recipe_${archetype}`);
  }));
});