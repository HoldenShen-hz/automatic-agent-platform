import assert from "node:assert/strict";
import test from "node:test";

import { createBasicEvaluatorPlugin } from "../../../../src/plugins/validators/basic-evaluator.js";
import { createBasicPlannerPlugin } from "../../../../src/plugins/planners/basic-planner.js";
import {
  createBuiltinPlugin,
  hasBuiltinPlugin,
  listBuiltinPluginIds,
} from "../../../../src/plugins/builtin-plugin-registry.js";
import { createGithubAdapterPlugin } from "../../../../src/plugins/adapters/github-adapter.js";
import { createCrmAdapterPlugin } from "../../../../src/plugins/adapters/crm-adapter.js";
import { createGameDevAdapterPlugin } from "../../../../src/plugins/adapters/game-dev-adapter.js";
import { createAssetProductionAdapterPlugin } from "../../../../src/plugins/adapters/asset-production-adapter.js";
import { createLivestreamAdapterPlugin } from "../../../../src/plugins/adapters/livestream-adapter.js";
import { createCodingPresenterPlugin } from "../../../../src/plugins/presenters/coding-presenter.js";
import { createGrowthPresenterPlugin } from "../../../../src/plugins/presenters/growth-presenter.js";
import { createOperationsPresenterPlugin } from "../../../../src/plugins/presenters/operations-presenter.js";
import { createCodingRetrieverPlugin } from "../../../../src/plugins/retrievers/coding-retriever.js";
import { createGrowthRetrieverPlugin } from "../../../../src/plugins/retrievers/growth-retriever.js";
import { createOperationsRetrieverPlugin } from "../../../../src/plugins/retrievers/operations-retriever.js";
import { createGameDevRetrieverPlugin } from "../../../../src/plugins/retrievers/game-dev-retriever.js";
import { createAssetProductionRetrieverPlugin } from "../../../../src/plugins/retrievers/asset-production-retriever.js";
import { createLivestreamRetrieverPlugin } from "../../../../src/plugins/retrievers/livestream-retriever.js";
import type { DomainRetrieverPlugin, RetrieverKnowledgeResult } from "../../../../src/domains/registry/plugin-spi.js";
import type { UnifiedAssessment } from "../../../../src/platform/orchestration/oapeflir/types/unified-assessment.js";

// ---------------------------------------------------------------------------
// Basic Evaluator Plugin Tests
// ---------------------------------------------------------------------------

test("BasicEvaluator validates with no errors when payload matches contract", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test-step",
    machineOutput: { stepId: "test-step", outputRef: null, payload: { name: "test", value: 42 } },
    contract: { requiredFields: ["name"], fieldTypes: { name: "string", value: "number" } },
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("BasicEvaluator detects missing required fields", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test-step",
    machineOutput: { stepId: "test-step", outputRef: null, payload: { name: "test" } },
    contract: { requiredFields: ["name", "description"] },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]!.field, "description");
  assert.equal(result.errors[0]!.severity, "error");
  assert.ok(result.suggestions.length > 0);
});

test("BasicEvaluator detects type mismatches", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test-step",
    machineOutput: { stepId: "test-step", outputRef: null, payload: { count: "not a number" } },
    contract: { fieldTypes: { count: "number" } },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]!.field, "count");
  assert.ok(result.errors[0].message.includes("Expected number"));
});

test("BasicEvaluator handles empty contract", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test-step",
    machineOutput: { stepId: "test-step", outputRef: null, payload: {} },
    contract: {},
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("BasicEvaluator handles missing optional fields in fieldTypes", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test-step",
    machineOutput: { stepId: "test-step", outputRef: null, payload: { name: "test" } },
    contract: { fieldTypes: { missing: "string" } },
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("BasicEvaluator handles null payload values", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test-step",
    machineOutput: { stepId: "test-step", outputRef: null, payload: { data: null } },
    contract: { requiredFields: ["data"] },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors[0]!.field, "data");
});

test("BasicEvaluator handles array type detection", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test-step",
    machineOutput: { stepId: "test-step", outputRef: null, payload: { items: [1, 2, 3] } },
    contract: { fieldTypes: { items: "array" } },
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("BasicEvaluator handles multiple errors and suggestions", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test-step",
    machineOutput: { stepId: "test-step", outputRef: null, payload: {} },
    contract: { requiredFields: ["a", "b"], fieldTypes: { c: "string" } },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 3); // a, b missing + c type mismatch
  assert.ok(result.suggestions.length >= 3);
});

test("BasicEvaluator lifecycle methods work", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const initResult = await plugin.initialize!();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck!();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown!();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Basic Planner Plugin Tests
// ---------------------------------------------------------------------------

function createMockAssessment(complexity: UnifiedAssessment["complexity"], risk: UnifiedAssessment["risk"], approvalRequired = false) {
  return {
    taskId: "task-1",
    intent: "test intent",
    assessment: {
      complexity,
      risk,
      approvalPolicy: { required: approvalRequired },
    } as UnifiedAssessment,
  };
}

test("BasicPlanner returns null for critical complexity", async () => {
  const plugin = createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow(createMockAssessment("critical", "low"));

  assert.equal(result, null);
});

test("BasicPlanner returns direct-execute for trivial complexity", async () => {
  const plugin = createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow(createMockAssessment("trivial", "low"));

  assert.ok(result != null);
  assert.equal(result.workflowId, "workflow.core.trivial");
  assert.equal(result.overrides.length, 1);
  assert.equal(result.overrides[0].stepName, "direct-execute");
});

test("BasicPlanner returns direct-execute for simple complexity", async () => {
  const plugin = createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow(createMockAssessment("simple", "low"));

  assert.ok(result != null);
  assert.equal(result.workflowId, "workflow.core.simple");
  assert.equal(result.overrides.length, 1);
  assert.equal(result.overrides[0].stepName, "direct-execute");
});

test("BasicPlanner returns plan-execute-review for moderate complexity without approval", async () => {
  const plugin = createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow(createMockAssessment("moderate", "medium"));

  assert.ok(result != null);
  assert.equal(result.workflowId, "workflow.core.moderate");
  assert.equal(result.overrides.length, 3);
  assert.equal(result.overrides[0].stepName, "plan");
  assert.equal(result.overrides[1].stepName, "execute");
  assert.equal(result.overrides[2].stepName, "review");
  assert.equal(result.overrides[2].requiresReview, false);
});

test("BasicPlanner returns plan-execute-review for moderate complexity with approval", async () => {
  const plugin = createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow(createMockAssessment("moderate", "high", true));

  assert.ok(result != null);
  assert.equal(result.overrides[2].requiresReview, true);
});

test("BasicPlanner returns full workflow for high complexity", async () => {
  const plugin = createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow(createMockAssessment("complex", "high", true));

  assert.ok(result != null);
  assert.equal(result.workflowId, "workflow.core.high");
  assert.ok(result.overrides.length >= 4);
  assert.equal(result.overrides[0].stepName, "plan");
  assert.equal(result.overrides[1].stepName, "approve");
  assert.equal(result.overrides[1].requiresReview, true);
});

test("BasicPlanner includes retry policy for moderate complexity", async () => {
  const plugin = createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow(createMockAssessment("moderate", "medium"));

  assert.ok(result != null);
  assert.deepEqual(result.overrides[1].retryPolicy, { maxRetries: 1, backoffMs: 500 });
});

test("BasicPlanner includes retry policy for high complexity", async () => {
  const plugin = createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow(createMockAssessment("high", "high"));

  assert.ok(result != null);
  assert.deepEqual(result.overrides[2].retryPolicy, { maxRetries: 2, backoffMs: 1000 });
});

test("BasicPlanner includes rationale in response", async () => {
  const plugin = createBasicPlannerPlugin();
  const result = await plugin.suggestWorkflow(createMockAssessment("simple", "low"));

  assert.ok(result != null);
  assert.ok(result.rationale.includes("assessment=simple"));
  assert.ok(result.rationale.includes("risk=low"));
});

test("BasicPlanner lifecycle methods work", async () => {
  const plugin = createBasicPlannerPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Builtin Plugin Registry Tests
// ---------------------------------------------------------------------------

test("listBuiltinPluginIds returns all plugin IDs", () => {
  const ids = listBuiltinPluginIds();

  assert.ok(ids.length > 0);
  assert.ok(ids.includes("plugin.coding.retriever"));
  assert.ok(ids.includes("plugin.core.basic-evaluator"));
  assert.ok(ids.includes("plugin.core.basic-planner"));
  assert.ok(ids.includes("plugin.growth.retriever"));
  assert.ok(ids.includes("plugin.operations.retriever"));
});

test("hasBuiltinPlugin returns true for known plugins", () => {
  assert.equal(hasBuiltinPlugin("plugin.coding.retriever"), true);
  assert.equal(hasBuiltinPlugin("plugin.core.basic-evaluator"), true);
  assert.equal(hasBuiltinPlugin("plugin.growth.crm_adapter"), true);
  assert.equal(hasBuiltinPlugin("plugin.livestream.retriever"), true);
});

test("hasBuiltinPlugin returns false for unknown plugins", () => {
  assert.equal(hasBuiltinPlugin("plugin.unknown"), false);
  assert.equal(hasBuiltinPlugin("plugin.fake.adapter"), false);
});

test("createBuiltinPlugin returns plugin for known ID", () => {
  const plugin = createBuiltinPlugin("plugin.core.basic-evaluator");

  assert.ok(plugin != null);
  assert.equal(plugin.pluginId, "plugin.core.basic-evaluator");
});

test("createBuiltinPlugin returns null for unknown ID", () => {
  const plugin = createBuiltinPlugin("plugin.doesnotexist");

  assert.equal(plugin, null);
});

test("createBuiltinPlugin creates all domain plugins correctly", () => {
  const pluginIds = [
    "plugin.coding.retriever",
    "plugin.coding.presenter",
    "plugin.growth.retriever",
    "plugin.growth.presenter",
    "plugin.growth.crm_adapter",
    "plugin.operations.retriever",
    "plugin.operations.presenter",
    "plugin.gamedev.retriever",
    "plugin.gamedev.unity_adapter",
    "plugin.assetproduction.retriever",
    "plugin.assetproduction.figma_adapter",
    "plugin.livestream.retriever",
    "plugin.livestream.obs_adapter",
  ];

  for (const id of pluginIds) {
    const plugin = createBuiltinPlugin(id);
    assert.ok(plugin != null, `Plugin ${id} should be created`);
    assert.equal(plugin.pluginId, id);
  }
});

// ---------------------------------------------------------------------------
// GitHub Adapter Plugin Tests
// ---------------------------------------------------------------------------

test("GithubAdapter authenticates with token", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "ghp_test123" });

  const result = await plugin.execute("create_issue", {
    repository: "owner/repo",
    title: "Test Issue",
    body: "Test body",
    labels: ["bug"],
  });

  assert.equal(result.repository, "owner/repo");
  assert.ok(result.credentialFingerprint.includes("ghp"));
});

test("GithubAdapter authenticates with managedSecretRef", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ managedSecretRef: "secret://github/token" });

  const result = await plugin.execute("create_issue", {
    repository: "owner/repo",
    title: "Test Issue",
    body: "Test body",
  });

  assert.ok(result.credentialFingerprint.startsWith("secret://"));
});

test("GithubAdapter throws when not authenticated", async () => {
  const plugin = createGithubAdapterPlugin();

  await assert.rejects(
    async () => plugin.execute("create_issue", { repository: "owner/repo", title: "Test", body: "Body" }),
    /github_adapter.not_authenticated/,
  );
});

test("GithubAdapter throws on missing repository", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  await assert.rejects(
    async () => plugin.execute("create_issue", { title: "Test", body: "Body" } as Record<string, unknown>),
    /github_adapter.missing_repository/,
  );
});

test("GithubAdapter throws on missing required fields", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  await assert.rejects(
    async () => plugin.execute("create_issue", { repository: "owner/repo" } as Record<string, unknown>),
    /github_adapter.missing_title/,
  );
});

test("GithubAdapter builds endpoint for create_issue", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  const result = await plugin.execute("create_issue", {
    repository: "owner/repo",
    title: "Test",
    body: "Body",
  });

  assert.ok((result.endpoint as string).includes("/repos/owner/repo/issues"));
});

test("GithubAdapter builds endpoint for create_pr_comment", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  const result = await plugin.execute("create_pr_comment", {
    repository: "owner/repo",
    issueNumber: "123",
    body: "Comment body",
  });

  assert.ok((result.endpoint as string).includes("/issues/123/comments"));
});

test("GithubAdapter builds endpoint for dispatch_workflow", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  const result = await plugin.execute("dispatch_workflow", {
    repository: "owner/repo",
    workflowId: "ci.yml",
    ref: "main",
  });

  assert.ok((result.endpoint as string).includes("/actions/workflows/ci.yml/dispatches"));
});

test("GithubAdapter builds endpoint for get_file", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  const result = await plugin.execute("get_file", {
    repository: "owner/repo",
    path: "README.md",
  });

  assert.ok((result.endpoint as string).includes("/contents/README.md"));
});

test("GithubAdapter builds payload for create_issue with labels", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  const result = await plugin.execute("create_issue", {
    repository: "owner/repo",
    title: "Test",
    body: "Body",
    labels: ["bug", "priority"],
  });

  assert.deepEqual(result.payload, {
    title: "Test",
    body: "Body",
    labels: ["bug", "priority"],
  });
});

test("GithubAdapter builds payload for dispatch_workflow with inputs", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  const result = await plugin.execute("dispatch_workflow", {
    repository: "owner/repo",
    workflowId: "ci.yml",
    ref: "main",
    inputs: { environment: "production" },
  });

  assert.deepEqual(result.payload, {
    workflowId: "ci.yml",
    ref: "main",
    inputs: { environment: "production" },
  });
});

test("GithubAdapter uses default ref for get_file when not provided", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  const result = await plugin.execute("get_file", {
    repository: "owner/repo",
    path: "README.md",
  });

  assert.equal((result.payload as Record<string, unknown>).ref, "main");
});

test("GithubAdapter healthCheck returns policy evaluation", async () => {
  const plugin = createGithubAdapterPlugin();
  const health = await plugin.healthCheck();

  assert.equal(typeof health, "boolean");
});

test("GithubAdapter lifecycle methods work", async () => {
  const plugin = createGithubAdapterPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(typeof healthResult, "boolean");

  await plugin.shutdown();
  // After shutdown, credentialFingerprint should be null
});

test("GithubAdapter clears credentials on shutdown", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  await plugin.shutdown();

  await assert.rejects(
    async () => plugin.execute("create_issue", { repository: "r", title: "t", body: "b" }),
    /github_adapter.not_authenticated/,
  );
});

test("GithubAdapter handles empty labels array", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  const result = await plugin.execute("create_issue", {
    repository: "owner/repo",
    title: "Test",
    body: "Body",
    labels: [],
  });

  assert.deepEqual(result.payload, {
    title: "Test",
    body: "Body",
    labels: [],
  });
});

test("GithubAdapter preserves non-array labels as empty array", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  const result = await plugin.execute("create_issue", {
    repository: "owner/repo",
    title: "Test",
    body: "Body",
    labels: "not-an-array",
  } as Record<string, unknown>);

  assert.deepEqual(result.payload, {
    title: "Test",
    body: "Body",
    labels: [],
  });
});

// ---------------------------------------------------------------------------
// CRM Adapter Plugin Tests
// ---------------------------------------------------------------------------

test("CrmAdapter authenticates with token", async () => {
  const plugin = createCrmAdapterPlugin();
  await plugin.authenticate({ token: "hubspot_token_123" });

  const result = await plugin.execute("contacts", {});

  assert.equal(result.ok, true);
  assert.equal((result.data as Record<string, unknown>).crmType, "hubspot");
});

test("CrmAdapter supports salesforce crmType", async () => {
  const plugin = createCrmAdapterPlugin({ crmType: "salesforce" });
  await plugin.authenticate({ token: "sf_token_123" });

  const result = await plugin.execute("contacts", {});

  assert.equal((result.data as Record<string, unknown>).crmType, "salesforce");
});

test("CrmAdapter returns structured response with action", async () => {
  const plugin = createCrmAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  const result = await plugin.execute("campaigns", { status: "active" });

  assert.equal(result.ok, true);
  assert.equal((result.data as Record<string, unknown>).action, "campaigns");
});

test("CrmAdapter healthCheck returns boolean", async () => {
  const plugin = createCrmAdapterPlugin();
  const health = await plugin.healthCheck();

  assert.equal(typeof health, "boolean");
});

test("CrmAdapter lifecycle methods work", async () => {
  const plugin = createCrmAdapterPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  await plugin.authenticate({ token: "test" });
  await plugin.shutdown();
});

test("CrmAdapter clears credentials on shutdown", async () => {
  const plugin = createCrmAdapterPlugin();
  await plugin.authenticate({ token: "test" });

  await plugin.shutdown();

  // After shutdown credential fingerprint is cleared, next execute should still work
  // but will have cleared fingerprint
  const result = await plugin.execute("contacts", {});
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Game Dev Adapter Plugin Tests
// ---------------------------------------------------------------------------

test("GameDevAdapter execute returns success response", async () => {
  const plugin = createGameDevAdapterPlugin();

  const result = await plugin.execute("build_status", {
    projectSlug: "my-game",
    buildTarget: "ios",
  });

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).projectSlug, "my-game");
  assert.equal((result.output as Record<string, unknown>).buildTarget, "ios");
});

test("GameDevAdapter handles null parameters", async () => {
  const plugin = createGameDevAdapterPlugin();

  const result = await plugin.execute("build_logs", {});

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).projectSlug, null);
  assert.equal((result.output as Record<string, unknown>).buildTarget, null);
});

test("GameDevAdapter healthCheck returns true", async () => {
  const plugin = createGameDevAdapterPlugin();
  const health = await plugin.healthCheck();

  assert.equal(health, true);
});

test("GameDevAdapter lifecycle methods work", async () => {
  const plugin = createGameDevAdapterPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Asset Production Adapter Plugin Tests
// ---------------------------------------------------------------------------

test("AssetProductionAdapter execute returns success response", async () => {
  const plugin = createAssetProductionAdapterPlugin();

  const result = await plugin.execute("get_file", {
    fileKey: "abc123",
    nodeId: "node456",
  });

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).fileKey, "abc123");
  assert.equal((result.output as Record<string, unknown>).nodeId, "node456");
});

test("AssetProductionAdapter handles null parameters", async () => {
  const plugin = createAssetProductionAdapterPlugin();

  const result = await plugin.execute("get_components", {});

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).fileKey, null);
  assert.equal((result.output as Record<string, unknown>).nodeId, null);
});

test("AssetProductionAdapter healthCheck returns true", async () => {
  const plugin = createAssetProductionAdapterPlugin();
  const health = await plugin.healthCheck();

  assert.equal(health, true);
});

test("AssetProductionAdapter lifecycle methods work", async () => {
  const plugin = createAssetProductionAdapterPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Livestream Adapter Plugin Tests
// ---------------------------------------------------------------------------

test("LivestreamAdapter execute returns success response", async () => {
  const plugin = createLivestreamAdapterPlugin();

  const result = await plugin.execute("get_scenes", {
    streamId: "stream123",
  });

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).streamId, "stream123");
});

test("LivestreamAdapter handles null parameters", async () => {
  const plugin = createLivestreamAdapterPlugin();

  const result = await plugin.execute("get_config", {});

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).streamId, null);
});

test("LivestreamAdapter healthCheck returns true", async () => {
  const plugin = createLivestreamAdapterPlugin();
  const health = await plugin.healthCheck();

  assert.equal(health, true);
});

test("LivestreamAdapter lifecycle methods work", async () => {
  const plugin = createLivestreamAdapterPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Coding Presenter Plugin Tests
// ---------------------------------------------------------------------------

test("CodingPresenter formats output with multiple steps", async () => {
  const plugin = createCodingPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "step1", outputRef: null, payload: { data: "test1" } },
      { stepId: "step2", outputRef: "ref-2", payload: { data: "test2" } },
    ],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(result.summary.includes("2 coding step(s)"));
  assert.equal(result.sections.length, 2);
  assert.ok(result.sections[0].includes("step1"));
});

test("CodingPresenter handles empty outputs", async () => {
  const plugin = createCodingPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [],
    artifacts: [],
    audience: "developer",
  });

  assert.equal(result.summary, "No coding output produced");
  assert.equal(result.sections.length, 0);
});

test("CodingPresenter includes artifacts section", async () => {
  const plugin = createCodingPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "step1", outputRef: null, payload: {} },
    ],
    artifacts: ["artifact://file1.ts", "artifact://file2.ts"],
    audience: "developer",
  });

  assert.ok(result.sections.some((s: string) => s.includes("Artifacts")));
  assert.ok(result.sections.some((s: string) => s.includes("file1.ts")));
});

test("CodingPresenter includes outputRef in section", async () => {
  const plugin = createCodingPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "step1", outputRef: "output-123", payload: { test: true } },
    ],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(result.sections[0].includes("outputRef: output-123"));
});

test("CodingPresenter lifecycle methods work", async () => {
  const plugin = createCodingPresenterPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Growth Presenter Plugin Tests
// ---------------------------------------------------------------------------

test("GrowthPresenter formats campaign output", async () => {
  const plugin = createGrowthPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      {
        stepId: "campaign-1",
        outputRef: "campaign-ref",
        payload: {
          type: "campaign",
          campaignName: "Summer Sale",
          reach: "10000",
          conversionRate: "5%",
          roas: "3.5x",
        },
      },
    ],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(result.summary.includes("Growth"));
  assert.ok(result.sections.some((s: string) => s.includes("Summer Sale")));
  assert.ok(result.sections.some((s: string) => s.includes("10000")));
  assert.ok(result.citations.includes("campaign-ref"));
});

test("GrowthPresenter formats abtest output", async () => {
  const plugin = createGrowthPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      {
        stepId: "abtest-1",
        outputRef: "abtest-ref",
        payload: {
          type: "abtest",
          testName: "Button Color Test",
          variant: "blue",
          lift: "12%",
          confidence: "95%",
        },
      },
    ],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(result.sections.some((s: string) => s.includes("Button Color Test")));
  assert.ok(result.sections.some((s: string) => s.includes("blue")));
  assert.ok(result.citations.includes("abtest-ref"));
});

test("GrowthPresenter formats generic output", async () => {
  const plugin = createGrowthPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "generic-1", outputRef: null, payload: { custom: "data" } },
    ],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(result.sections.some((s: string) => s.includes("generic-1")));
  assert.ok(result.sections.some((s: string) => s.includes("custom")));
});

test("GrowthPresenter handles multiple outputs", async () => {
  const plugin = createGrowthPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "step1", outputRef: "ref1", payload: { type: "campaign", campaignName: "A", reach: "100", conversionRate: "1%", roas: "1x" } },
      { stepId: "step2", outputRef: "ref2", payload: { type: "abtest", testName: "B", variant: "control", lift: "5%", confidence: "90%" } },
    ],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(result.summary.includes("2 steps"));
  assert.equal(result.sections.length, 2);
});

test("GrowthPresenter handles empty outputs", async () => {
  const plugin = createGrowthPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [],
    artifacts: [],
    audience: "end_user",
  });

  assert.equal(result.summary, "No growth output produced");
  assert.equal(result.sections.length, 0);
});

test("GrowthPresenter includes artifacts", async () => {
  const plugin = createGrowthPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "step1", outputRef: null, payload: { type: "generic", data: "test" } },
    ],
    artifacts: ["artifact://campaign-data.json"],
    audience: "end_user",
  });

  assert.ok(result.sections.some((s: string) => s.includes("Artifacts")));
});

test("GrowthPresenter lifecycle methods work", async () => {
  const plugin = createGrowthPresenterPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Operations Presenter Plugin Tests
// ---------------------------------------------------------------------------

test("OperationsPresenter formats incident output", async () => {
  const plugin = createOperationsPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      {
        stepId: "incident-1",
        outputRef: "incident-ref",
        payload: {
          type: "incident",
          severity: "critical",
          system: "payment-service",
          description: "Payment processing failure",
        },
      },
    ],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(result.summary.includes("Operations"));
  assert.ok(result.sections.some((s: string) => s.includes("CRITICAL")));
  assert.ok(result.sections.some((s: string) => s.includes("payment-service")));
  assert.ok(result.citations.includes("incident-ref"));
});

test("OperationsPresenter formats runbook output", async () => {
  const plugin = createOperationsPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      {
        stepId: "runbook-1",
        outputRef: "runbook-ref",
        payload: {
          type: "runbook",
          title: "Database Backup",
          steps: ["Step 1: Connect", "Step 2: Execute backup", "Step 3: Verify"],
        },
      },
    ],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(result.sections.some((s: string) => s.includes("Database Backup")));
  assert.ok(result.sections.some((s: string) => s.includes("1. Connect")));
  assert.ok(result.sections.some((s: string) => s.includes("3. Verify")));
});

test("OperationsPresenter formats generic output", async () => {
  const plugin = createOperationsPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "generic-1", outputRef: null, payload: { custom: "data" } },
    ],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(result.sections.some((s: string) => s.includes("generic-1")));
});

test("OperationsPresenter handles empty steps array in runbook", async () => {
  const plugin = createOperationsPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      {
        stepId: "runbook-1",
        outputRef: null,
        payload: {
          type: "runbook",
          title: "Empty Runbook",
          steps: [],
        },
      },
    ],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(result.sections.some((s: string) => s.includes("Empty Runbook")));
});

test("OperationsPresenter handles missing fields with defaults", async () => {
  const plugin = createOperationsPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "step1", outputRef: null, payload: {} },
    ],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(result.sections.some((s: string) => s.includes("step1")));
});

test("OperationsPresenter handles multiple outputs", async () => {
  const plugin = createOperationsPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "incident-1", outputRef: "i1", payload: { type: "incident", severity: "high", system: "sys1", description: "desc1" } },
      { stepId: "runbook-1", outputRef: "r1", payload: { type: "runbook", title: "Title", steps: ["s1"] } },
    ],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(result.summary.includes("2 steps"));
  assert.equal(result.sections.length, 2);
});

test("OperationsPresenter handles empty outputs", async () => {
  const plugin = createOperationsPresenterPlugin();
  const result = await plugin.formatOutput({
    machineOutputs: [],
    artifacts: [],
    audience: "operator",
  });

  assert.equal(result.summary, "No operational output produced");
  assert.equal(result.sections.length, 0);
});

test("OperationsPresenter lifecycle methods work", async () => {
  const plugin = createOperationsPresenterPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Coding Retriever Plugin Tests
// ---------------------------------------------------------------------------

test("CodingRetriever returns structured results", async () => {
  const plugin = createCodingRetrieverPlugin({ rootPath: "/tmp" });
  await plugin.initialize();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "find user authentication code",
    context: {},
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  // Results depend on the actual repo state, but should have correct structure
  for (const item of result) {
    assert.ok(item.knowledgeRef.startsWith("knowledge:"));
    assert.ok(item.namespace === "repo/coding");
  }
});

test("CodingRetriever respects token budget", async () => {
  const plugin = createCodingRetrieverPlugin({ rootPath: "/tmp" });
  await plugin.initialize();

  const smallBudget = await plugin.retrieve({
    taskId: "task-1",
    intent: "test",
    context: {},
    tokenBudget: 200, // Very small budget
  });

  const largeBudget = await plugin.retrieve({
    taskId: "task-1",
    intent: "test",
    context: {},
    tokenBudget: 5000,
  });

  // Small budget should return fewer results (min 2, max based on budget/250)
  assert.ok(smallBudget.length <= largeBudget.length);
});

test("CodingRetriever uses context.currentFile", async () => {
  const plugin = createCodingRetrieverPlugin({ rootPath: "/tmp" });
  await plugin.initialize();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "test query",
    context: { currentFile: "/tmp/test.ts" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
});

test("CodingRetriever healthCheck returns boolean", async () => {
  const plugin = createCodingRetrieverPlugin({ rootPath: "/tmp" });
  await plugin.initialize();

  const health = await plugin.healthCheck();
  assert.equal(typeof health, "boolean");
});

test("CodingRetriever lifecycle methods work", async () => {
  const plugin = createCodingRetrieverPlugin({ rootPath: "/tmp" });

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(typeof healthResult, "boolean");

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Growth Retriever Plugin Tests
// ---------------------------------------------------------------------------

test("GrowthRetriever returns structured results", async () => {
  const plugin = createGrowthRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "campaign optimization strategies",
    context: { campaign: "summer-sale" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 2);
  assert.ok(result.length <= 8);

  assert.ok(result.some((r) => r.namespace === "growth/playbooks"));
  assert.ok(result.some((r) => r.namespace === "growth/campaigns"));
  assert.ok(result.some((r) => r.namespace === "growth/ab_tests"));
});

test("GrowthRetriever builds query with context", async () => {
  const plugin = createGrowthRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "A/B testing",
    context: { campaign: "black-friday", metric: "conversion" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  assert.ok(result.every((r) => r.matchType === "semantic" || r.matchType === "keyword"));
});

test("GrowthRetriever respects token budget for limiting results", async () => {
  const plugin = createGrowthRetrieverPlugin();

  const smallBudget = await plugin.retrieve({
    taskId: "task-1",
    intent: "test",
    context: {},
    tokenBudget: 150, // Very small budget
  });

  const largeBudget = await plugin.retrieve({
    taskId: "task-1",
    intent: "test",
    context: {},
    tokenBudget: 2000, // Large budget
  });

  // Should respect min/max limits
  assert.ok(smallBudget.length >= 2);
  assert.ok(largeBudget.length <= 8);
});

test("GrowthRetriever returns results with proper structure", async () => {
  const plugin = createGrowthRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "growth strategies",
    context: {},
    tokenBudget: 1000,
  });

  for (const item of result) {
    assert.ok(item.knowledgeRef.startsWith("knowledge:growth/"));
    assert.ok(typeof item.score === "number");
    assert.ok(typeof item.snippet === "string");
    assert.ok(typeof item.namespace === "string");
  }
});

test("GrowthRetriever lifecycle methods work", async () => {
  const plugin = createGrowthRetrieverPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Operations Retriever Plugin Tests
// ---------------------------------------------------------------------------

test("OperationsRetriever returns structured results", async () => {
  const plugin = createOperationsRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "runbook for database backup",
    context: { system: "postgresql" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 2);
  assert.ok(result.length <= 8);

  assert.ok(result.some((r) => r.namespace === "operations/runbooks"));
  assert.ok(result.some((r) => r.namespace === "operations/incidents"));
});

test("OperationsRetriever builds query with context components", async () => {
  const plugin = createOperationsRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "incident response",
    context: { system: "api-gateway", component: "auth-service" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  for (const item of result) {
    assert.ok(item.knowledgeRef.includes("query="));
  }
});

test("OperationsRetriever returns different match types", async () => {
  const plugin = createOperationsRetrieverPlugin();

  const result: readonly RetrieverKnowledgeResult[] = await plugin.retrieve({
    taskId: "task-1",
    intent: "test query",
    context: {},
    tokenBudget: 1000,
  });

  const matchTypes = result.map((r: RetrieverKnowledgeResult) => r.matchType);
  assert.ok(matchTypes.includes("semantic") || matchTypes.includes("keyword"));
});

test("OperationsRetriever lifecycle methods work", async () => {
  const plugin = createOperationsRetrieverPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Game Dev Retriever Plugin Tests
// ---------------------------------------------------------------------------

test("GameDevRetriever returns structured results", async () => {
  const plugin = createGameDevRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "Unity build configuration",
    context: { project: "my-game", platform: "ios" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 2);
  assert.ok(result.length <= 8);

  assert.ok(result.some((r) => r.namespace === "gamedev/projects"));
  assert.ok(result.some((r) => r.namespace === "gamedev/builds"));
  assert.ok(result.some((r) => r.namespace === "gamedev/design_docs"));
  assert.ok(result.some((r) => r.namespace === "gamedev/assets"));
});

test("GameDevRetriever builds query with multiple context fields", async () => {
  const plugin = createGameDevRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "scene optimization",
    context: { project: "game-1", platform: "pc", scene: "main-menu" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  assert.ok(result.every((r) => r.knowledgeRef.includes("query=")));
});

test("GameDevRetriever returns results with various match types", async () => {
  const plugin = createGameDevRetrieverPlugin();

  const result: readonly RetrieverKnowledgeResult[] = await plugin.retrieve({
    taskId: "task-1",
    intent: "asset references",
    context: {},
    tokenBudget: 1000,
  });

  const matchTypes = result.map((r: RetrieverKnowledgeResult) => r.matchType);
  assert.ok(matchTypes.includes("semantic") || matchTypes.includes("keyword") || matchTypes.includes("structural"));
});

test("GameDevRetriever lifecycle methods work", async () => {
  const plugin = createGameDevRetrieverPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Asset Production Retriever Plugin Tests
// ---------------------------------------------------------------------------

test("AssetProductionRetriever returns structured results", async () => {
  const plugin = createAssetProductionRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "design tokens for button",
    context: { file: "design-system.figma", format: "svg" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 2);
  assert.ok(result.length <= 8);

  assert.ok(result.some((r) => r.namespace === "assetprod/figma"));
  assert.ok(result.some((r) => r.namespace === "assetprod/cdn"));
  assert.ok(result.some((r) => r.namespace === "assetprod/design_tokens"));
  assert.ok(result.some((r) => r.namespace === "assetprod/metadata"));
});

test("AssetProductionRetriever builds query with brand context", async () => {
  const plugin = createAssetProductionRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "logo assets",
    context: { brand: "acme-corp", format: "png" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  for (const item of result) {
    assert.ok(item.knowledgeRef.startsWith("knowledge:assetprod/"));
  }
});

test("AssetProductionRetriever respects token budget", async () => {
  const plugin = createAssetProductionRetrieverPlugin();

  const smallBudget = await plugin.retrieve({
    taskId: "task-1",
    intent: "test",
    context: {},
    tokenBudget: 100,
  });

  const largeBudget = await plugin.retrieve({
    taskId: "task-1",
    intent: "test",
    context: {},
    tokenBudget: 2000,
  });

  assert.ok(smallBudget.length >= 2);
  assert.ok(largeBudget.length <= 8);
  assert.ok(smallBudget.length <= largeBudget.length);
});

test("AssetProductionRetriever lifecycle methods work", async () => {
  const plugin = createAssetProductionRetrieverPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});

// ---------------------------------------------------------------------------
// Livestream Retriever Plugin Tests
// ---------------------------------------------------------------------------

test("LivestreamRetriever returns structured results", async () => {
  const plugin = createLivestreamRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "OBS configuration for gaming stream",
    context: { stream: "weekly-gaming", platform: "twitch" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 2);
  assert.ok(result.length <= 8);

  assert.ok(result.some((r) => r.namespace === "livestream/obs"));
  assert.ok(result.some((r) => r.namespace === "livestream/analytics"));
  assert.ok(result.some((r) => r.namespace === "livestream/engagement"));
  assert.ok(result.some((r) => r.namespace === "livestream/content_plans"));
});

test("LivestreamRetriever builds query with all context fields", async () => {
  const plugin = createLivestreamRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "stream analytics",
    context: { stream: "live-event", platform: "youtube", metric: "viewer-count" },
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(result));
  for (const item of result) {
    assert.ok(item.knowledgeRef.startsWith("knowledge:livestream/"));
    assert.ok(item.knowledgeRef.includes("query="));
  }
});

test("LivestreamRetriever returns results with correct structure", async () => {
  const plugin = createLivestreamRetrieverPlugin();

  const result = await plugin.retrieve({
    taskId: "task-1",
    intent: "engagement metrics",
    context: {},
    tokenBudget: 1000,
  });

  for (const item of result) {
    assert.ok(typeof item.score === "number");
    assert.ok(typeof item.snippet === "string");
    assert.ok(typeof item.namespace === "string");
    assert.ok(typeof item.chunkId === "string");
    assert.ok(typeof item.documentId === "string");
  }
});

test("LivestreamRetriever lifecycle methods work", async () => {
  const plugin = createLivestreamRetrieverPlugin();

  const initResult = await plugin.initialize();
  assert.equal(initResult, undefined);

  const healthResult = await plugin.healthCheck();
  assert.equal(healthResult, true);

  const shutdownResult = await plugin.shutdown();
  assert.equal(shutdownResult, undefined);
});
