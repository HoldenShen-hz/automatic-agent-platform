import assert from "node:assert/strict";
import test from "node:test";

import { createCodingPresenterPlugin } from "../../../../src/plugins/presenters/coding-presenter.js";

test("CodingPresenter has correct plugin metadata", () => {
  const plugin = createCodingPresenterPlugin();

  assert.equal(plugin.pluginId, "plugin.coding.presenter");
  assert.equal(plugin.domainId, "coding");
  assert.equal(plugin.spiType, "presenter");
});

test("CodingPresenter has correct capabilityIds", () => {
  const plugin = createCodingPresenterPlugin();

  assert.deepEqual(plugin.capabilityIds, ["present.output", "present.diff", "present.summary"]);
});

test("CodingPresenter.initialize returns undefined", async () => {
  const plugin = createCodingPresenterPlugin();
  assert.ok(plugin.initialize !== undefined);
  const result = await plugin.initialize();
  assert.equal(result, undefined);
});

test("CodingPresenter.healthCheck returns true", async () => {
  const plugin = createCodingPresenterPlugin();
  assert.ok(plugin.healthCheck !== undefined);
  const result = await plugin.healthCheck();
  assert.equal(result, true);
});

test("CodingPresenter.shutdown returns undefined", async () => {
  const plugin = createCodingPresenterPlugin();
  assert.ok(plugin.shutdown !== undefined);
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});

test("CodingPresenter.formatOutput formats single step correctly", async () => {
  const plugin = createCodingPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "step_1",
      outputRef: "output_ref_1",
      payload: { key: "value" },
    }],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(result.sections.length > 0);
  assert.ok(result.sections[0]?.includes("step_1"));
  assert.ok(result.sections[0]?.includes("outputRef: output_ref_1"));
  assert.ok(result.sections[0]?.includes("```json"));
});

test("CodingPresenter.formatOutput shows inline for missing outputRef", async () => {
  const plugin = createCodingPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "inline_step",
      outputRef: null,
      payload: { data: 123 },
    }],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(result.sections[0]?.includes("outputRef: inline"));
});

test("CodingPresenter.formatOutput includes artifacts section", async () => {
  const plugin = createCodingPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "step_1",
      outputRef: "ref_1",
      payload: {},
    }],
    artifacts: ["artifact://code/1", "artifact://code/2"],
    audience: "developer",
  });

  assert.ok(result.sections.some(s => s.includes("Artifacts")));
  assert.ok(result.sections.some(s => s.includes("artifact://code/1")));
  assert.ok(result.sections.some(s => s.includes("artifact://code/2")));
});

test("CodingPresenter.formatOutput returns no output message when empty", async () => {
  const plugin = createCodingPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [],
    artifacts: [],
    audience: "developer",
  });

  assert.equal(result.summary, "No coding output produced");
  assert.equal(result.sections.length, 0);
});

test("CodingPresenter.formatOutput summary lists completed steps", async () => {
  const plugin = createCodingPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "step_a", outputRef: null, payload: {} },
      { stepId: "step_b", outputRef: null, payload: {} },
    ],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(result.summary.includes("step_a, step_b"));
});

test("CodingPresenter.formatOutput prefers nodeRunId when legacy stepId is absent", async () => {
  const plugin = createCodingPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      nodeRunId: "node_run_1",
      outputRef: null,
      payload: {},
    }],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(result.summary.includes("node_run_1"));
  assert.ok(result.sections[0]?.includes("node_run_1"));
});

test("CodingPresenter.formatOutput citations come from artifacts", async () => {
  const plugin = createCodingPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "step_1",
      outputRef: null,
      payload: {},
    }],
    artifacts: ["artifact://code/main.ts"],
    audience: "developer",
  });

  assert.deepEqual(result.citations, ["artifact://code/main.ts"]);
});
