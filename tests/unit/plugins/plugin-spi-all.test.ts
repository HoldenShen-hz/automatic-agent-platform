/**
 * @fileoverview Unit tests for all Plugin SPI types
 *
 * Tests tool, evaluator, retriever, planner, presenter, and adapter SPI interfaces.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createBasicPlannerPlugin } from "../../../src/plugins/planners/basic-planner.js";
import { createBasicEvaluatorPlugin } from "../../../src/plugins/validators/basic-evaluator.js";
import { createCodingPresenterPlugin } from "../../../src/plugins/presenters/coding-presenter.js";
import { createGithubAdapterPlugin } from "../../../src/plugins/adapters/github-adapter.js";
import { createCrmAdapterPlugin } from "../../../src/plugins/adapters/crm-adapter.js";
import { createGameDevAdapterPlugin } from "../../../src/plugins/adapters/game-dev-adapter.js";
import { createAssetProductionAdapterPlugin } from "../../../src/plugins/adapters/asset-production-adapter.js";
import { createLivestreamAdapterPlugin } from "../../../src/plugins/adapters/livestream-adapter.js";
import { createGrowthPresenterPlugin } from "../../../src/plugins/presenters/growth-presenter.js";
import { createOperationsPresenterPlugin } from "../../../src/plugins/presenters/operations-presenter.js";
import type { DomainPlannerPlugin, DomainEvaluatorPlugin, DomainPresenterPlugin, ExternalAdapterPlugin } from "../../../src/domains/registry/plugin-spi.js";

// ---------------------------------------------------------------------------
// Planner SPI tests
// ---------------------------------------------------------------------------

test("DomainPlannerPlugin has required lifecycle hooks", () => {
  const planner = createBasicPlannerPlugin();

  assert.equal(typeof planner.initialize, "function");
  assert.equal(typeof planner.shutdown, "function");
  assert.equal(typeof planner.healthCheck, "function");
  assert.equal(typeof planner.suggestWorkflow, "function");
});

test("DomainPlannerPlugin lifecycle hooks return expected types", async () => {
  const planner = createBasicPlannerPlugin();

  const initResult = await planner.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await planner.healthCheck();
  assert.equal(typeof healthResult, "boolean");

  const shutdownResult = await planner.shutdown();
  assert.equal(shutdownResult, undefined);
});

test("DomainPlannerPlugin suggests workflow with all required fields", async () => {
  const planner = createBasicPlannerPlugin();

  const suggestion = await planner.suggestWorkflow({
    taskId: "task_spi_test",
    intent: "test task",
    assessment: {
      taskId: "task_spi_test",
      timestamp: Date.now(),
      situationRef: "test",
      phase: "pre-execution",
      complexity: "simple" as const,
      risk: "low" as const,
      riskAssessment: { level: "low", factors: [] },
      routingDecision: { division: "core", workflow: "default", rationale: "test" },
      resourceAllocation: { modelClass: "standard", maxTokens: 1000, timeoutMs: 60000 },
      approvalPolicy: { required: false },
      executionMode: "auto",
      suggestedActions: [],
    },
  });

  assert.ok(suggestion !== null);
  assert.equal(typeof suggestion.workflowId, "string");
  assert.ok(Array.isArray(suggestion.overrides));
  assert.equal(typeof suggestion.rationale, "string");
});

// ---------------------------------------------------------------------------
// Evaluator SPI tests
// ---------------------------------------------------------------------------

test("DomainEvaluatorPlugin has required lifecycle hooks", () => {
  const evaluator = createBasicEvaluatorPlugin();

  assert.equal(typeof evaluator.initialize, "function");
  assert.equal(typeof evaluator.shutdown, "function");
  assert.equal(typeof evaluator.healthCheck, "function");
  assert.equal(typeof evaluator.validate, "function");
});

test("DomainEvaluatorPlugin validate returns validation result structure", async () => {
  const evaluator = createBasicEvaluatorPlugin();

  const result = await evaluator.validate({
    stepId: "step_1",
    machineOutput: {
      stepId: "step_1",
      outputRef: null,
      payload: { summary: "ok", passed: true },
    },
    contract: {
      requiredFields: ["summary", "passed"],
      fieldTypes: { summary: "string", passed: "boolean" },
    },
  });

  assert.equal(typeof result.valid, "boolean");
  assert.ok(Array.isArray(result.errors));
  assert.ok(Array.isArray(result.suggestions));
});

test("DomainEvaluatorPlugin validate handles empty contract", async () => {
  const evaluator = createBasicEvaluatorPlugin();

  const result = await evaluator.validate({
    stepId: "step_1",
    machineOutput: {
      stepId: "step_1",
      outputRef: null,
      payload: {},
    },
    contract: {},
  });

  assert.equal(result.valid, true);
});

// ---------------------------------------------------------------------------
// Presenter SPI tests
// ---------------------------------------------------------------------------

test("DomainPresenterPlugin has required lifecycle hooks", () => {
  const presenter = createCodingPresenterPlugin();

  assert.equal(typeof presenter.initialize, "function");
  assert.equal(typeof presenter.shutdown, "function");
  assert.equal(typeof presenter.healthCheck, "function");
  assert.equal(typeof presenter.formatOutput, "function");
});

test("DomainPresenterPlugin formatOutput returns HumanOutput structure", async () => {
  const presenter = createCodingPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "test_step",
        outputRef: "artifact:test",
        payload: { status: "ok" },
      },
    ],
    artifacts: ["artifact:test"],
    audience: "developer",
  });

  assert.equal(typeof output.summary, "string");
  assert.ok(Array.isArray(output.sections));
  assert.ok(Array.isArray(output.citations));
});

test("CodingPresenter formats machine outputs as JSON sections", async () => {
  const presenter = createCodingPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "compile",
        outputRef: "artifact:dist",
        payload: { files: ["a.js", "b.js"] },
      },
    ],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(output.summary.includes("compile"));
  assert.ok(output.sections.some((s) => s.includes("```json")));
});

test("GrowthPresenter formats campaign and abtest payloads specially", async () => {
  const presenter = createGrowthPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "campaign_step",
        outputRef: null,
        payload: { type: "campaign", campaignName: "Summer Sale", reach: "10000", conversionRate: "5%", roas: "3x" },
      },
    ],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(output.summary.includes("Growth"));
  assert.ok(output.sections.some((s) => s.includes("Campaign:")));
  assert.ok(output.sections.some((s) => s.includes("Summer Sale")));
});

test("GrowthPresenter formats abtest payloads specially", async () => {
  const presenter = createGrowthPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "abtest_step",
        outputRef: null,
        payload: { type: "abtest", testName: "CTA Test", variant: "B", lift: "12%", confidence: "95%" },
      },
    ],
    artifacts: [],
    audience: "reviewer",
  });

  assert.ok(output.sections.some((s) => s.includes("A/B Test:")));
  assert.ok(output.sections.some((s) => s.includes("CTA Test")));
});

test("OperationsPresenter has correct plugin metadata", () => {
  const presenter = createOperationsPresenterPlugin();

  assert.equal(presenter.pluginId, "plugin.operations.presenter");
  assert.equal(presenter.domainId, "operations");
  assert.equal(presenter.spiType, "presenter");
});

// ---------------------------------------------------------------------------
// Adapter SPI tests
// ---------------------------------------------------------------------------

test("ExternalAdapterPlugin has required lifecycle hooks", () => {
  const adapter = createGithubAdapterPlugin();

  assert.equal(typeof adapter.initialize, "function");
  assert.equal(typeof adapter.shutdown, "function");
  assert.equal(typeof adapter.healthCheck, "function");
  assert.equal(typeof adapter.authenticate, "function");
  assert.equal(typeof adapter.execute, "function");
});

test("GithubAdapter authenticate stores credential fingerprint", async () => {
  const adapter = createGithubAdapterPlugin();

  await adapter.authenticate({ token: "ghp_test_token_12345" });
  // authenticate stores fingerprint but doesn't return it
  // Next execute call would use it
  const result = await adapter.execute("create_issue", {
    repository: "test/repo",
    title: "Test",
    body: "Test body",
    labels: [],
  });

  assert.equal(result.endpoint, "https://api.github.com/repos/test/repo/issues");
});

test("GithubAdapter execute builds correct endpoint for create_issue", async () => {
  const adapter = createGithubAdapterPlugin();

  await adapter.authenticate({ token: "ghp_test_token" });
  const result = await adapter.execute("create_issue", {
    repository: "owner/repo",
    title: "Test Issue",
    body: "Issue body",
    labels: ["bug"],
  });

  assert.ok(result.endpoint.includes("/repos/owner/repo/issues"));
  assert.equal(result.payload.title, "Test Issue");
});

test("GithubAdapter execute builds correct endpoint for get_file", async () => {
  const adapter = createGithubAdapterPlugin();

  await adapter.authenticate({ token: "ghp_test_token" });
  const result = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "src/index.ts",
    ref: "main",
  });

  assert.ok(result.endpoint.includes("/repos/owner/repo/contents/"));
  assert.equal(result.payload.path, "src/index.ts");
  assert.equal(result.payload.ref, "main");
});

test("GithubAdapter execute throws without authentication", async () => {
  const adapter = createGithubAdapterPlugin();

  await assert.rejects(
    async () => adapter.execute("create_issue", { repository: "test/repo", title: "Test", body: "Body" }),
    /not_authenticated/i,
  );
});

test("GithubAdapter requires repository parameter", async () => {
  const adapter = createGithubAdapterPlugin();

  await adapter.authenticate({ token: "ghp_test_token" });
  await assert.rejects(
    async () => adapter.execute("create_issue", { title: "Test", body: "Body" }),
    /missing_repository/i,
  );
});

test("CrmAdapter authenticate handles token and managedSecretRef", async () => {
  const adapter = createCrmAdapterPlugin();

  await adapter.authenticate({ token: "hubspot_token_123" });
  const result = await adapter.execute("contacts", { query: "test" });

  assert.equal(result.data.crmType, "hubspot");
});

test("CrmAdapter execute respects egress policy", async () => {
  const adapter = createCrmAdapterPlugin();

  await adapter.authenticate({ token: "test_token" });
  const result = await adapter.execute("contacts", { query: "test" });

  assert.equal(result.ok, true);
  assert.equal(result.data.action, "contacts");
});

test("CrmAdapter plugin has correct metadata", () => {
  const adapter = createCrmAdapterPlugin();

  assert.equal(adapter.pluginId, "plugin.growth.crm_adapter");
  assert.equal(adapter.adapterType, "crm_analytics");
  assert.ok(adapter.capabilityIds.includes("external.hubspot"));
});

test("GameDevAdapter execute returns expected structure", async () => {
  const adapter = createGameDevAdapterPlugin();

  await adapter.authenticate({ credentials: "unity_creds" });
  const result = await adapter.execute("build_status", {
    projectSlug: "my-project",
    buildTarget: "Standalone",
  });

  assert.equal(result.success, true);
  assert.equal(result.output.projectSlug, "my-project");
  assert.equal(result.output.buildTarget, "Standalone");
});

test("GameDevAdapter plugin has correct metadata", () => {
  const adapter = createGameDevAdapterPlugin();

  assert.equal(adapter.pluginId, "plugin.gamedev.unity_adapter");
  assert.equal(adapter.adapterType, "unity_cloud_build");
  assert.ok(adapter.capabilityIds.includes("build.status"));
});

test("AssetProductionAdapter execute returns expected structure", async () => {
  const adapter = createAssetProductionAdapterPlugin();

  await adapter.authenticate({ apiKey: "figma_key" });
  const result = await adapter.execute("get_file", {
    fileKey: "abc123",
    nodeId: "1:2",
  });

  assert.equal(result.success, true);
  assert.equal(result.output.fileKey, "abc123");
});

test("LivestreamAdapter execute returns expected structure", async () => {
  const adapter = createLivestreamAdapterPlugin();

  await adapter.authenticate({ obsToken: "obs_password" });
  const result = await adapter.execute("get_scene", {
    streamId: "live-123",
  });

  assert.equal(result.success, true);
  assert.equal(result.output.streamId, "live-123");
});

test("All adapter plugins implement ExternalAdapterPlugin interface", () => {
  const adapters = [
    createGithubAdapterPlugin(),
    createCrmAdapterPlugin(),
    createGameDevAdapterPlugin(),
    createAssetProductionAdapterPlugin(),
    createLivestreamAdapterPlugin(),
  ];

  for (const adapter of adapters) {
    assert.equal(typeof adapter.pluginId, "string");
    assert.equal(adapter.spiType, "adapter");
    assert.equal(typeof adapter.authenticate, "function");
    assert.equal(typeof adapter.execute, "function");
  }
});

test("All presenter plugins implement DomainPresenterPlugin interface", () => {
  const presenters = [
    createCodingPresenterPlugin(),
    createGrowthPresenterPlugin(),
    createOperationsPresenterPlugin(),
  ];

  for (const presenter of presenters) {
    assert.equal(typeof presenter.pluginId, "string");
    assert.equal(presenter.spiType, "presenter");
    assert.equal(typeof presenter.formatOutput, "function");
  }
});

test("All retriever plugins implement DomainRetrieverPlugin interface", () => {
  // Retriever plugins require options, just verify the interface
  const { createCodingRetrieverPlugin } = require("../../../src/plugins/retrievers/coding-retriever.js");
  const retriever = createCodingRetrieverPlugin();

  assert.equal(typeof retriever.pluginId, "string");
  assert.equal(retriever.spiType, "retriever");
  assert.equal(typeof retriever.retrieve, "function");
});

test("Planner plugin has correct capabilityIds", () => {
  const planner = createBasicPlannerPlugin();

  assert.ok(Array.isArray(planner.capabilityIds));
  assert.ok(planner.capabilityIds.includes("workflow.suggest"));
});

test("Evaluator plugin has correct capabilityIds", () => {
  const evaluator = createBasicEvaluatorPlugin();

  assert.ok(Array.isArray(evaluator.capabilityIds));
  assert.ok(evaluator.capabilityIds.includes("output.validate"));
});