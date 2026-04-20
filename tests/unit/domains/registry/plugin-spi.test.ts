import test from "node:test";
import assert from "node:assert/strict";

import type {
  DomainPlannerPlugin,
  DomainPresenterPlugin,
  DomainRetrieverPlugin,
  DomainValidatorPlugin,
  ExternalAdapterPlugin,
} from "../../../../src/domains/registry/plugin-spi.js";

test("plugin spi interfaces support minimal mock implementations", async () => {
  const retriever: DomainRetrieverPlugin = {
    pluginId: "retriever.demo",
    domainId: "coding",
    spiType: "retriever",
    capabilityIds: ["knowledge.retrieve"],
    async retrieve() { return [{ knowledgeRef: "knowledge:chunk_1", snippet: "test chunk", score: 0.9, namespace: "coding/repo", chunkId: "chunk_1", documentId: "doc_1", matchType: "semantic" }]; },
    async onLoad() {},
    async onActivate() {},
    async healthCheck() { return true; },
    async onDeactivate() {},
    async onUnload() {},
  };
  const validator: DomainValidatorPlugin = {
    pluginId: "validator.demo",
    domainId: "coding",
    spiType: "validator",
    async validate() { return { valid: true, errors: [], suggestions: [] }; },
    async onLoad() {},
    async healthCheck() { return true; },
    async onUnload() {},
  };
  const planner: DomainPlannerPlugin = {
    pluginId: "planner.demo",
    domainId: "coding",
    spiType: "planner",
    async suggestWorkflow() { return null; },
    async onLoad() {},
    async healthCheck() { return true; },
    async onUnload() {},
  };
  const presenter: DomainPresenterPlugin = {
    pluginId: "presenter.demo",
    domainId: "coding",
    spiType: "presenter",
    async formatOutput() { return { summary: "ok", sections: [], citations: [] }; },
    async onLoad() {},
    async healthCheck() { return true; },
    async onUnload() {},
  };
  const adapter: ExternalAdapterPlugin = {
    pluginId: "adapter.demo",
    spiType: "adapter",
    adapterType: "github",
    async authenticate() {},
    async execute() { return { ok: true }; },
    async onLoad() {},
    async healthCheck() { return true; },
    async onUnload() {},
  };

  const retrievalResults = await retriever.retrieve({ taskId: "task_1", intent: "fix bug", context: {}, tokenBudget: 1000 });
  assert.equal(retrievalResults.length, 1);
  assert.equal(retrievalResults[0]!.knowledgeRef, "knowledge:chunk_1");
  assert.equal(retrievalResults[0]!.score, 0.9);
  assert.equal((await validator.validate({ stepId: "step_1", machineOutput: { stepId: "step_1", outputRef: null, payload: {} }, contract: {} })).valid, true);
  assert.equal(await planner.suggestWorkflow({
    taskId: "task_1",
    intent: "fix bug",
    assessment: {
      taskId: "task_1",
      timestamp: Date.now(),
      situationRef: "task_situation:task_1:1",
      phase: "pre-execution",
      complexity: "simple",
      risk: "low",
      riskAssessment: { level: "low", factors: [] },
      routingDecision: { division: "coding", workflow: "wf_1", rationale: "simple" },
      resourceAllocation: { modelClass: "small", maxTokens: 1000, timeoutMs: 1000 },
      approvalPolicy: { required: false, level: "none" },
      executionMode: "auto",
      suggestedActions: [],
    },
  }), null);
  assert.equal((await presenter.formatOutput({ machineOutputs: [], artifacts: [], audience: "developer" })).summary, "ok");
  assert.equal((await adapter.execute("noop", {})).ok, true);
});

test("DomainRetrieverPlugin returns empty results for no matches", async () => {
  const retriever: DomainRetrieverPlugin = {
    pluginId: "retriever.empty",
    domainId: "coding",
    spiType: "retriever",
    capabilityIds: ["knowledge.retrieve"],
    async retrieve() { return []; },
    async onLoad() {},
    async onActivate() {},
    async healthCheck() { return true; },
    async onDeactivate() {},
    async onUnload() {},
  };

  const result = await retriever.retrieve({ taskId: "task_2", intent: "unknown", context: {}, tokenBudget: 500 });
  assert.deepEqual(result, []);
});

test("DomainValidatorPlugin returns invalid with errors", async () => {
  const validator: DomainValidatorPlugin = {
    pluginId: "validator.invalid",
    domainId: "coding",
    spiType: "validator",
    async validate() {
      return {
        valid: false,
        errors: [{ field: "output", message: "missing required field", severity: "error" as const }],
        suggestions: ["add required field"],
      };
    },
    async onLoad() {},
    async healthCheck() { return true; },
    async onUnload() {},
  };

  const result = await validator.validate({
    stepId: "step_2",
    machineOutput: { stepId: "step_2", outputRef: null, payload: {} },
    contract: {},
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0]?.field, "output");
  assert.equal(result.errors[0]?.severity, "error");
});

test("DomainPlannerPlugin suggests workflow when appropriate", async () => {
  const planner: DomainPlannerPlugin = {
    pluginId: "planner.suggest",
    domainId: "coding",
    spiType: "planner",
    async suggestWorkflow() {
      return {
        workflowId: "suggested_wf",
        overrides: [],
        rationale: "complex task detected",
      };
    },
    async onLoad() {},
    async healthCheck() { return true; },
    async onUnload() {},
  };

  const result = await planner.suggestWorkflow({
    taskId: "task_3",
    intent: "complex refactor",
    assessment: {
      taskId: "task_3",
      timestamp: Date.now(),
      situationRef: "task_situation:task_3:1",
      phase: "pre-execution",
      complexity: "complex",
      risk: "high",
      riskAssessment: { level: "high", factors: ["complex_refactor"] },
      routingDecision: { division: "coding", workflow: "wf_complex", rationale: "complex" },
      resourceAllocation: { modelClass: "large", maxTokens: 8000, timeoutMs: 5000 },
      approvalPolicy: { required: true, level: "admin" },
      executionMode: "manual",
      suggestedActions: [],
    },
  });
  assert.equal(result?.workflowId, "suggested_wf");
  assert.equal(result?.rationale, "complex task detected");
});

test("DomainPresenterPlugin returns structured sections", async () => {
  const presenter: DomainPresenterPlugin = {
    pluginId: "presenter.structured",
    domainId: "coding",
    spiType: "presenter",
    async formatOutput() {
      return {
        summary: "task completed",
        sections: ["The patch was applied", "Modified 3 files"],
        citations: ["artifact:patch_diff"],
      };
    },
    async onLoad() {},
    async healthCheck() { return true; },
    async onUnload() {},
  };

  const result = await presenter.formatOutput({
    machineOutputs: [{ stepId: "step_1", outputRef: "ref_1", payload: {} }],
    artifacts: ["artifact:patch_diff"],
    audience: "developer",
  });
  assert.equal(result.summary, "task completed");
  assert.equal(result.sections.length, 2);
  assert.equal(result.citations.length, 1);
});

test("ExternalAdapterPlugin returns error on failure", async () => {
  const adapter: ExternalAdapterPlugin = {
    pluginId: "adapter.fail",
    spiType: "adapter",
    adapterType: "github",
    async authenticate() {},
    async execute() { return { ok: false, error: "rate limited" }; },
    async onLoad() {},
    async healthCheck() { return false; },
    async onUnload() {},
  };

  const result = await adapter.execute("push", { ref: "main" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "rate limited");
});

test("DomainRetrieverPlugin healthCheck returns false when unhealthy", async () => {
  const retriever: DomainRetrieverPlugin = {
    pluginId: "retriever.unhealthy",
    domainId: "coding",
    spiType: "retriever",
    capabilityIds: ["knowledge.retrieve"],
    async retrieve() { return []; },
    async onLoad() {},
    async onActivate() {},
    async healthCheck() { return false; },
    async onDeactivate() {},
    async onUnload() {},
  };

  const healthy = await retriever.healthCheck!();
  assert.equal(healthy, false);
});
