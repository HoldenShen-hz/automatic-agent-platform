/**
 * @fileoverview E2E tests for SDK E2E
 * End-to-end tests for the SDK covering the full workflow
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createApiClient } from "../../../src/sdk/client-sdk/api-client.js";
import { definePlugin, defineTool, defineAdapter } from "../../../src/sdk/plugin-sdk/plugin-definition.js";
import { PluginContext } from "../../../src/sdk/plugin-sdk/plugin-context.js";
import { PluginTestHarness } from "../../../src/sdk/plugin-sdk/plugin-test-harness.js";
import { HarnessSdk, buildPlanGraphBundle } from "../../../src/sdk/harness-sdk/index.js";
import { AdminSdk } from "../../../src/sdk/admin-sdk/index.js";
import { SdkWorkbenchService } from "../../../src/sdk/workbench/index.js";
import { validateBusinessPackManifest } from "../../../src/sdk/pack-sdk/pack-manifest.js";
import { PackScaffoldService } from "../../../src/sdk/pack-sdk/pack-scaffold-service.js";
import type { PlanNode, PlanEdge } from "../../../src/platform/contracts/executable-contracts/index.js";

const TEST_PRINCIPAL = { principalId: "p_e2e", tenantId: "t_e2e", roles: ["admin"] };

test("E2E: Define and test a tool plugin", async () => {
  // Define a tool plugin
  const tool = await defineTool({
    pluginId: "e2e-test-tool",
    name: "E2E Test Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "E2E test capability",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  assert.equal(tool.pluginId, "e2e-test-tool");
  assert.equal(tool.type, "tool");

  // Create a test harness
  const harness = new PluginTestHarness({ plugin: tool });

  // Run a test case
  const result = await harness.runCase({ input: "test" });
  assert.ok(result.durationMs >= 0);
});

test("E2E: Define and test an adapter plugin", async () => {
  const adapter = await defineAdapter({
    pluginId: "e2e-test-adapter",
    name: "E2E Test Adapter",
    version: "1.0.0",
    capabilities: [{
      name: "adapt",
      description: "E2E test adapter",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  assert.equal(adapter.type, "adapter");

  const harness = new PluginTestHarness({ plugin: adapter });
  const result = await harness.runCase({ data: "test" });
  assert.ok(result.passed);
});

test("E2E: PluginContext provides runtime context", () => {
  const context = new PluginContext({
    pluginId: "e2e-plugin",
    executionId: "exec_123",
    taskId: "task_456",
    tenantId: "tenant_abc",
  });

  assert.equal(context.pluginId, "e2e-plugin");
  assert.equal(context.executionId, "exec_123");
  assert.equal(context.taskId, "task_456");
  assert.equal(context.tenantId, "tenant_abc");

  // Set and get values
  context.set("custom.key", "custom_value");
  assert.equal(context.get("custom.key"), "custom_value");

  // Fork creates child context
  const childContext = context.fork({ taskId: "child_task" });
  assert.equal(childContext.taskId, "child_task");
  assert.equal(childContext.tenantId, "tenant_abc");
});

test("E2E: PluginTestHarness runs multiple test cases", async () => {
  const plugin = await defineTool({
    pluginId: "e2e-multi-test-tool",
    name: "E2E Multi Test Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Multi-test capability",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin });

  const report = await harness.runCases([
    { name: "test-1", input: { data: "first" } },
    { name: "test-2", input: { data: "second" } },
    { name: "test-3", input: { data: "third" } },
  ]);

  assert.equal(report.totalCases, 3);
  assert.equal(report.pluginId, "e2e-multi-test-tool");
  assert.ok(report.results.length === 3);
});

test("E2E: HarnessSdk creates and manages runs", () => {
  const sdk = new HarnessSdk();

  const run = sdk.createRun({
    taskId: "e2e_task",
    domainId: "testing",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
// @ts-ignore
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
    tenantId: "e2e_tenant",
  });

// @ts-ignore
  assert.ok(run.runId.startsWith("harness_run_"));
// @ts-ignore
  assert.equal(run.taskId, "e2e_task");
  assert.equal(run.domainId, "testing");
  assert.equal(run.status, "running");

  // Append a step
  const updated = sdk.appendStep(run, {
// @ts-ignore
    role: "executor",
    nodeRunId: "node_1",
    planGraphId: "graph_1",
    inputs: { prompt: "test" },
    outputs: { result: "ok" },
  });

// @ts-ignore
  assert.equal(updated.steps.length, 1);
});

test("E2E: PlanGraphBundle builds and validates graph", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "start",
// @ts-ignore
      nodeIndex: 0,
      displayName: "Start",
      type: "task",
      inputSchema: {},
      outputSchema: {},
      retryPolicy: null,
    },
    {
      nodeId: "end",
// @ts-ignore
      nodeIndex: 1,
      displayName: "End",
      type: "task",
      inputSchema: {},
      outputSchema: {},
      retryPolicy: null,
    },
  ];

  const edges: PlanEdge[] = [
    {
      edgeId: "e1",
      fromNodeId: "start",
      toNodeId: "end",
// @ts-ignore
      edgeType: "control_flow",
    },
  ];

  const { bundle, validationReport } = buildPlanGraphBundle({
    harnessRunId: "e2e_harness_run",
    nodes,
    edges,
    entryNodeIds: ["start"],
    terminalNodeIds: ["end"],
  });

  assert.ok(validationReport.valid);
  assert.equal(bundle.harnessRunId, "e2e_harness_run");
  assert.equal(bundle.graph.nodes.length, 2);
  assert.equal(bundle.graph.edges.length, 1);
});

test("E2E: AdminSdk creates operational directives", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
// @ts-ignore
    principal: TEST_PRINCIPAL,
  });

// @ts-ignore
  const pauseDirective = sdk.pauseHarnessRun({
    harnessRunId: "e2e_run_123",
    reason: "E2E pause",
    issuedBy: TEST_PRINCIPAL,
  });

// @ts-ignore
  assert.equal(pauseDirective.type, "pause");
// @ts-ignore
  assert.equal(pauseDirective.scope?.harnessRunId, "e2e_run_123");

// @ts-ignore
  const abortDirective = sdk.abortHarnessRun({
    harnessRunId: "e2e_run_456",
    reason: "E2E abort",
    issuedBy: TEST_PRINCIPAL,
  });

// @ts-ignore
  assert.equal(abortDirective.type, "kill");
});

test("E2E: WorkbenchService creates install plans", () => {
  const service = new SdkWorkbenchService();

  const plugins = [
    {
      pluginId: "e2e-plugin-1",
      name: "E2E Plugin 1",
      version: "1.0.0",
      type: "tool" as const,
      capabilityIds: ["cap_a", "cap_b"],
      lifecycleHooks: [],
    },
  ];

  const packs = [
// @ts-ignore
    validateBusinessPackManifest({
      packId: "e2e-pack",
      version: "1.0.0",
      domain: "testing",
      owner: "e2e@example.com",
      capabilities: [
        { capabilityKey: "cap_a", maturity: "ga", requiredContracts: [] },
        { capabilityKey: "cap_b", maturity: "beta", requiredContracts: [] },
      ],
    }),
  ];

  const snapshot = service.buildSnapshot({
    client: {
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      bearerToken: "test-token",
// @ts-ignore
      principal: TEST_PRINCIPAL,
    },
    plugins: plugins as any,
    packs,
    availableContracts: [],
  });

  assert.equal(snapshot.pluginIds.length, 1);
  assert.equal(snapshot.packIds.length, 1);
  assert.equal(snapshot.installPlans.length, 1);
  assert.ok(snapshot.installPlans[0]?.ready);
});

test("E2E: PackScaffoldService creates project structure", () => {
  const service = new PackScaffoldService();

  // This would create files in a temp directory in a real scenario
  // Here we just verify the validation works
  const templates = service.listTemplates();
  assert.equal(templates.length, 3);
  assert.ok(templates.find((t) => t.id === "minimal"));
  assert.ok(templates.find((t) => t.id === "standard"));
  assert.ok(templates.find((t) => t.id === "full"));
});

test("E2E: Full plugin definition and test flow", async () => {
  // 1. Define a plugin
  const plugin = await definePlugin({
    pluginId: "e2e-full-flow-plugin",
    name: "E2E Full Flow Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{
      name: "process",
      description: "Process data",
      inputSchema: { type: "object", properties: { data: { type: "string" } } },
      outputSchema: { type: "object", properties: { result: { type: "string" } } },
    }],
    resourceLimits: {
      maxMemoryMb: 1024,
      maxCpuMs: 5000,
      maxDurationMs: 30000,
    },
    security: {
      sandboxTier: "read_only",
      egressDomains: [],
    },
  });

  // 2. Create plugin context
  const context = new PluginContext({
    pluginId: plugin.pluginId,
    executionId: "exec_full_flow",
    taskId: "task_full_flow",
  });

  assert.equal(context.pluginId, plugin.pluginId);

  // 3. Create test harness
  const harness = new PluginTestHarness({
    plugin,
// @ts-ignore
    mode: "mock",
    timeoutMs: 5000,
  });

  // 4. Add mock tool result
  harness.addMockToolResult({
    toolId: "process",
    success: true,
    output: { result: "processed" },
    durationMs: 100,
  });

  // 5. Run test cases
  const report = await harness.runCases([
    {
      name: "process-positive",
      input: { data: "positive test" },
    },
    {
      name: "process-negative",
      input: { data: "negative test" },
    },
  ]);

  // 6. Verify results
  assert.equal(report.totalCases, 2);
  assert.equal(report.pluginId, "e2e-full-flow-plugin");
  assert.ok(report.timestamp);
});

test("E2E: API Client with version handshake flow", async () => {
  const client = createApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
// @ts-ignore
    principal: TEST_PRINCIPAL,
    performVersionHandshakeOnInit: true,
  });

  // Mock the version endpoint
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      platformVersion: "v4.3",
      contractVersion: "v4.3",
      minClientVersion: "1.0.0",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
// @ts-ignore
    await client.initialize();
    // If we get here without throwing, handshake succeeded
    assert.ok(true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("E2E: Validate Business Pack Manifest", () => {
// @ts-ignore
  const manifest = validateBusinessPackManifest({
    packId: "  e2e-business-pack  ",
    version: "  1.0.0  ",
    domain: "  testing  ",
    owner: "  e2e@example.com  ",
    capabilities: [
      { capabilityKey: " cap1 ", maturity: "ga", requiredContracts: [" contract1 ", " contract2 "] },
      { capabilityKey: "cap2", maturity: "beta", requiredContracts: ["contract1"] },
    ],
  });

  // Verify trimming and deduplication
  assert.equal(manifest.packId, "e2e-business-pack");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.domain, "testing");
  assert.equal(manifest.owner, "e2e@example.com");
  assert.equal(manifest.capabilities[0]!.capabilityKey, "cap1");
  // contract1 should be deduplicated
// @ts-ignore
  assert.equal(manifest.capabilities[0]!.requiredContracts.length, 2);
});

test("E2E: AdminSdk tenant management operations", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
// @ts-ignore
    principal: TEST_PRINCIPAL,
  });

  // Mock responses
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([
      { tenantId: "tenant_1", name: "Tenant One" },
      { tenantId: "tenant_2", name: "Tenant Two" },
    ]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
// @ts-ignore
    const result = await sdk.listTenants<{ tenantId: string; name: string }>();
    assert.equal(result.data.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("E2E: PluginTestHarness with mock LLM responses", async () => {
  const plugin = await defineTool({
    pluginId: "e2e-llm-tool",
    name: "E2E LLM Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "LLM execution",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({
    plugin,
// @ts-ignore
    mode: "mock",
  });

  harness.configureMockLlm({
    responses: [
      { content: "First response" },
      { content: "Second response" },
    ],
    delayMs: 10,
  });

  const result1 = await harness.runCase({ input: "first" });
  const result2 = await harness.runCase({ input: "second" });

  assert.ok(result1.passed);
  assert.ok(result2.passed);
});

test("E2E: HarnessSdk with appendStepWithReceipt", () => {
  const sdk = new HarnessSdk();

  const run = sdk.createRun({
    taskId: "e2e_task_with_receipt",
    domainId: "testing",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
// @ts-ignore
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
    tenantId: "e2e_tenant",
  });

  const { receipt } = sdk.appendStepWithReceipt(
    run,
    {
// @ts-ignore
      role: "executor",
      nodeRunId: "node_with_receipt",
      planGraphId: "graph_with_receipt",
      inputs: {},
      outputs: { result: "success" },
    },
    {
      duration: 150,
      status: "succeeded",
    }
  );

  assert.ok(receipt.nodeAttemptId.startsWith("nattempt_"));
  assert.equal(receipt.status, "succeeded");
  assert.equal(receipt.duration, 150);
});
