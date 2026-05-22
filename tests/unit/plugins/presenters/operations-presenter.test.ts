import assert from "node:assert/strict";
import test from "node:test";

import { createOperationsPresenterPlugin } from "../../../../src/plugins/presenters/operations-presenter.js";

test("OperationsPresenter type exports are correct", () => {
  const plugin = createOperationsPresenterPlugin();
  assert.ok(plugin !== undefined);
});

test("OperationsPresenter has correct plugin metadata", () => {
  const plugin = createOperationsPresenterPlugin();

  assert.equal(plugin.pluginId, "plugin.operations.presenter");
  assert.equal(plugin.domainId, "operations");
  assert.equal(plugin.spiType, "presenter");
});

test("OperationsPresenter has correct capabilityIds", () => {
  const plugin = createOperationsPresenterPlugin();

  assert.deepEqual(plugin.capabilityIds, ["present.output", "present.incident", "present.runbook"]);
});

test("OperationsPresenter.initialize returns undefined", async () => {
  const plugin = createOperationsPresenterPlugin();
  assert.ok(plugin.initialize !== undefined);
  const result = await plugin.initialize();
  assert.equal(result, undefined);
});

test("OperationsPresenter.healthCheck reflects lifecycle state", async () => {
  const plugin = createOperationsPresenterPlugin();
  assert.ok(plugin.healthCheck !== undefined);
  assert.equal(await plugin.healthCheck(), false);
  await plugin.initialize?.();
  assert.equal(await plugin.healthCheck(), true);
});

test("OperationsPresenter.shutdown returns undefined", async () => {
  const plugin = createOperationsPresenterPlugin();
  assert.ok(plugin.shutdown !== undefined);
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});

test("OperationsPresenter.formatOutput formats incident type correctly", async () => {
  const plugin = createOperationsPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "incident_step",
      outputRef: "ref_incident",
      payload: {
        type: "incident",
        severity: "critical",
        system: "payment-service",
        description: "Payment processing is down",
      },
    }],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(result.sections.length > 0);
  assert.ok(result.sections[0]?.includes("[CRITICAL]"));
  assert.ok(result.sections[0]?.includes("payment-service"));
  assert.ok(result.sections[0]?.includes("Payment processing is down"));
});

test("OperationsPresenter.formatOutput formats runbook type correctly", async () => {
  const plugin = createOperationsPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "runbook_step",
      outputRef: "ref_runbook",
      payload: {
        type: "runbook",
        title: "DB Restart Procedure",
        steps: ["Stop service", "Restart database", "Verify connectivity"],
      },
    }],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(result.sections.length > 0);
  assert.ok(result.sections[0]?.includes("DB Restart Procedure"));
  assert.ok(result.sections[0]?.includes("1. Stop service"));
  assert.ok(result.sections[0]?.includes("2. Restart database"));
  assert.ok(result.sections[0]?.includes("3. Verify connectivity"));
});

test("OperationsPresenter.formatOutput formats generic type as JSON", async () => {
  const plugin = createOperationsPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "generic_step",
      outputRef: null,
      payload: { data: "test" },
    }],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(result.sections.length > 0);
  assert.ok(result.sections[0]?.includes("generic_step"));
  assert.ok(result.sections[0]?.includes("```json"));
});

test("OperationsPresenter.formatOutput includes artifacts section", async () => {
  const plugin = createOperationsPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "incident_1",
      outputRef: "ref_1",
      payload: { type: "incident", severity: "high", system: "api", description: "High latency" },
    }],
    artifacts: ["artifact://ops/runbook/123"],
    audience: "operator",
  });

  assert.ok(result.sections.some(s => s.includes("Artifacts")));
  assert.ok(result.sections.some(s => s.includes("artifact://ops/runbook/123")));
});

test("OperationsPresenter.formatOutput returns no output message when empty", async () => {
  const plugin = createOperationsPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [],
    artifacts: [],
    audience: "operator",
  });

  assert.equal(result.summary, "No operational output produced");
  assert.equal(result.sections.length, 0);
  assert.equal(result.citations.length, 0);
});

test("OperationsPresenter.formatOutput handles missing optional fields in incident", async () => {
  const plugin = createOperationsPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "incomplete_incident",
      outputRef: null,
      payload: { type: "incident" },
    }],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(result.sections.length > 0);
  assert.ok(result.sections[0]?.includes("unknown"));
});

test("OperationsPresenter.formatOutput handles missing optional fields in runbook", async () => {
  const plugin = createOperationsPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "minimal_runbook",
      outputRef: null,
      payload: { type: "runbook" },
    }],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(result.sections.length > 0);
  assert.ok(result.sections[0]?.includes("minimal_runbook"));
});

test("OperationsPresenter.formatOutput formats multiple outputs correctly", async () => {
  const plugin = createOperationsPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [
      {
        stepId: "incident_1",
        outputRef: "ref_1",
        payload: { type: "incident", severity: "low", system: "web", description: "Minor issue" },
      },
      {
        stepId: "runbook_1",
        outputRef: "ref_2",
        payload: { type: "runbook", title: "Quick Fix", steps: ["Step A"] },
      },
    ],
    artifacts: [],
    audience: "reviewer",
  });

  assert.equal(result.sections.length, 2);
  assert.ok(result.citations.includes("ref_1"));
  assert.ok(result.citations.includes("ref_2"));
});
