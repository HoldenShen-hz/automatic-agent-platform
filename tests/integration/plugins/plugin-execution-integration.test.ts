/**
 * Integration Test: Plugin Execution
 *
 * Verifies plugin execution flows including retriever retrieval,
 * presenter formatting, adapter authentication and execution,
 * and validator evaluation.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { PluginSpiRegistry } from "../../../src/domains/registry/plugin-spi-registry.js";
import { createBuiltinPlugin } from "../../../src/plugins/builtin-plugin-registry.js";
import { createOperationsRetrieverPluginWithOptions } from "../../../src/plugins/retrievers/operations-retriever.js";

test("plugin execution integration: coding retriever retrieves knowledge", async () => {
  const registry = new PluginSpiRegistry();

  // Create temp workspace with code files
  const workspace = mkdtempSync(join(tmpdir(), "aa-plugin-retriever-int-"));
  try {
    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(
      join(workspace, "src", "api.ts"),
      "export async function fetchUserData(userId: string) {\n  return { id: userId, name: 'Test User' };\n}\n",
      "utf8",
    );
    writeFileSync(
      join(workspace, "src", "utils.ts"),
      "export function parseConfig(config: unknown) {\n  return JSON.parse(JSON.stringify(config));\n}\n",
      "utf8",
    );

    // Create retriever with workspace config
    const retriever = createBuiltinPlugin("plugin.coding.retriever");
    assert.ok(retriever);
    registry.register(retriever);

    const results = await registry.invokeRetriever("plugin.coding.retriever", {
      query: {
        taskId: "task_integration_retriever",
        intent: "fetchUserData utility function",
        context: { workspaceRoot: workspace },
        tokenBudget: 2000,
      },
    });

    assert.ok(results, "should return results");
    // Result can be string reference or object with knowledgeRef
    if (typeof results[0] === "object" && results[0] !== null) {
      assert.ok("knowledgeRef" in results[0] || "snippet" in results[0]);
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("plugin execution integration: coding presenter formats output", async () => {
  const registry = new PluginSpiRegistry();

  const presenter = createBuiltinPlugin("plugin.coding.presenter");
  assert.ok(presenter);
  registry.register(presenter);

  await registry.ensureActive("plugin.coding.presenter");

  const output = await registry.invokePresenter("plugin.coding.presenter", {
    machineOutputs: [
      {
        stepId: "step_compile",
        outputRef: "artifact:compiled",
        payload: {
          files: ["dist/index.js", "dist/utils.js"],
          warnings: [],
          durationMs: 1500,
        },
      },
      {
        stepId: "step_test",
        outputRef: "artifact:test-report",
        payload: {
          passed: 42,
          failed: 0,
          skipped: 3,
        },
      },
    ],
    artifacts: ["artifact:compiled", "artifact:test-report"],
    audience: "developer",
  });

  assert.ok(output, "should return formatted output");
  assert.ok(output.summary, "should have summary");
  assert.ok(Array.isArray(output.sections), "sections should be array");
  assert.ok(Array.isArray(output.citations), "citations should be array");
  assert.ok(output.citations.includes("artifact:compiled"));
  assert.ok(output.citations.includes("artifact:test-report"));
});

test("plugin execution integration: github adapter authenticates and executes", async () => {
  const registry = new PluginSpiRegistry();

  const githubAdapter = createBuiltinPlugin("plugin.shared.github_adapter");
  assert.ok(githubAdapter);
  registry.register(githubAdapter, {
    pluginId: "plugin.shared.github_adapter",
    name: "github_adapter",
    version: "1.0.0",
    owner: "test",
    domainIds: [],
    capabilityIds: [],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: true,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: ["api.github.com"],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  });

  await registry.invokeAdapterAuthenticate("plugin.shared.github_adapter", {
    credentials: { token: "github_test_token_12345" },
  });

  await registry.ensureActive("plugin.shared.github_adapter");

  // Execute action
  const result = await registry.invokeAdapterExecute("plugin.shared.github_adapter", {
    action: "create_issue",
    params: {
      repository: "anthropic/example-repo",
      title: "Integration test issue",
      body: "This is an integration test",
      labels: ["test", "integration"],
    },
  });

  assert.ok(result, "should return result");
  assert.ok("endpoint" in result || "id" in result || "number" in result);
});

test("plugin execution integration: basic evaluator validates output", async () => {
  const registry = new PluginSpiRegistry();

  const evaluator = createBuiltinPlugin("plugin.core.basic-evaluator");
  assert.ok(evaluator);
  registry.register(evaluator);

  await registry.ensureActive("plugin.core.basic-evaluator");

  const validation = await (evaluator as any).validate({
    stepId: "step_validate",
    machineOutput: {
      stepId: "step_validate",
      outputRef: null,
      payload: { summary: "All checks passed", passed: true, count: 5 },
    },
    contract: {
      requiredFields: ["summary", "passed"],
      fieldTypes: {
        summary: "string",
        passed: "boolean",
      },
    },
  });

  assert.ok(validation, "should return validation result");
  assert.equal(validation.valid, true, "should be valid");
  assert.ok(Array.isArray(validation.errors));
});

test("plugin execution integration: basic planner suggests workflow", async () => {
  const registry = new PluginSpiRegistry();

  const planner = createBuiltinPlugin("plugin.core.basic-planner");
  assert.ok(planner);
  registry.register(planner);

  await registry.ensureActive("plugin.core.basic-planner");

  const suggestion = await (planner as any).suggestWorkflow({
    taskId: "task_integration_planner",
    intent: "deploy and test new feature",
    assessment: {
      taskId: "task_integration_planner",
      timestamp: Date.now(),
      situationRef: "task_situation:task_integration_planner:1",
      phase: "pre-execution",
      complexity: "moderate",
      risk: "medium",
      riskAssessment: { level: "medium", factors: [] },
      routingDecision: { division: "coding", workflow: "multi-step", rationale: "moderate complexity" },
      resourceAllocation: { modelClass: "medium", maxTokens: 3000, timeoutMs: 30000 },
      approvalPolicy: { required: false, level: "none" },
      executionMode: "auto",
      suggestedActions: [],
    },
  });

  assert.ok(suggestion, "should return suggestion");
  assert.ok(suggestion.workflowId, "should have workflow id");
  assert.ok(Array.isArray(suggestion.overrides), "should have overrides array");
  assert.ok(suggestion.rationale, "should have rationale");
});

test("plugin execution integration: operations retriever returns results", async () => {
  const registry = new PluginSpiRegistry();

  const retriever = createOperationsRetrieverPluginWithOptions({ healthCheck: () => true });
  assert.ok(retriever);
  registry.register(retriever);

  const results = await registry.invokeRetriever("plugin.operations.retriever", {
    query: {
      taskId: "task_ops_retriever",
      intent: "system health status",
      context: {},
      tokenBudget: 1000,
    },
  });

  assert.ok(results, "should return results");
});

test("plugin execution integration: growth retriever and presenter work together", async () => {
  const registry = new PluginSpiRegistry();

  const growthRetriever = createBuiltinPlugin("plugin.growth.retriever");
  const growthPresenter = createBuiltinPlugin("plugin.growth.presenter");

  assert.ok(growthRetriever);
  assert.ok(growthPresenter);

  registry.register(growthRetriever);
  registry.register(growthPresenter);

  // Retrieve growth data
  const retrieverResults = await registry.invokeRetriever("plugin.growth.retriever", {
    query: {
      taskId: "task_growth_integration",
      intent: "user engagement metrics",
      context: {},
      tokenBudget: 1500,
    },
  });

  assert.ok(retrieverResults, "retriever should return results");

  // Present growth data
  await registry.ensureActive("plugin.growth.presenter");

  const presenterOutput = await registry.invokePresenter("plugin.growth.presenter", {
    machineOutputs: [
      {
        stepId: "step_growth",
        outputRef: null,
        payload: { metrics: retrieverResults },
      },
    ],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(presenterOutput, "presenter should return output");
});

test("plugin execution integration: plugin invocations track lifecycle state", async () => {
  const registry = new PluginSpiRegistry();

  const retriever = createBuiltinPlugin("plugin.coding.retriever")!;
  registry.register(retriever);

  // Initial state should be registered
  const initialRecord = registry.get("plugin.coding.retriever");
  assert.equal(initialRecord?.lifecycleState, "registered");

  // After ensureActive, state should be active
  await registry.ensureActive("plugin.coding.retriever");

  const activeRecord = registry.get("plugin.coding.retriever");
  assert.equal(activeRecord?.lifecycleState, "active");

  // After invocation, should still be active (no failures)
  const workspace = mkdtempSync(join(tmpdir(), "aa-lifecycle-track-"));
  try {
    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(join(workspace, "src", "main.ts"), "export const version = '1.0.0';\n", "utf8");

    await registry.invokeRetriever("plugin.coding.retriever", {
      query: {
        taskId: "task_lifecycle",
        intent: "version constant",
        context: { workspaceRoot: workspace },
        tokenBudget: 500,
      },
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }

  const afterInvokeRecord = registry.get("plugin.coding.retriever");
  assert.equal(afterInvokeRecord?.lifecycleState, "active");
});

test("plugin execution integration: multiple plugins can be activated concurrently", async () => {
  const registry = new PluginSpiRegistry();

  registry.register(createBuiltinPlugin("plugin.coding.retriever")!);
  registry.register(createBuiltinPlugin("plugin.coding.presenter")!);
  registry.register(createBuiltinPlugin("plugin.core.basic-planner")!);
  registry.register(createBuiltinPlugin("plugin.core.basic-evaluator")!);

  // Activate all concurrently
  const results = await Promise.all([
    registry.ensureActive("plugin.coding.retriever"),
    registry.ensureActive("plugin.coding.presenter"),
    registry.ensureActive("plugin.core.basic-planner"),
    registry.ensureActive("plugin.core.basic-evaluator"),
  ]);

  assert.equal(results.length, 4);
  assert.ok(results.every((p) => p !== null));
});
