/**
 * Unit Tests: Plugin Presenter Patterns
 *
 * Tests for presenter plugin patterns including formatOutput for different
 * audiences and domain-specific formatting.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createCodingPresenterPlugin } from "../../../src/plugins/presenters/coding-presenter.js";
import { createGrowthPresenterPlugin } from "../../../src/plugins/presenters/growth-presenter.js";
import { createOperationsPresenterPlugin } from "../../../src/plugins/presenters/operations-presenter.js";
import type { HumanOutput } from "../../../src/domains/registry/plugin-spi.js";

test("All presenter plugins implement DomainPresenterPlugin interface", () => {
  const presenters = [
    createCodingPresenterPlugin(),
    createGrowthPresenterPlugin(),
    createOperationsPresenterPlugin(),
  ];

  for (const presenter of presenters) {
    assert.equal(presenter.spiType, "presenter");
    assert.equal(typeof presenter.formatOutput, "function");
    assert.equal(typeof presenter.initialize, "function");
    assert.equal(typeof presenter.shutdown, "function");
    assert.equal(typeof presenter.healthCheck, "function");
  }
});

test("CodingPresenter has correct plugin metadata", () => {
  const presenter = createCodingPresenterPlugin();

  assert.equal(presenter.pluginId, "plugin.coding.presenter");
  assert.equal(presenter.domainId, "coding");
  assert.equal(presenter.spiType, "presenter");
});

test("GrowthPresenter has correct plugin metadata", () => {
  const presenter = createGrowthPresenterPlugin();

  assert.equal(presenter.pluginId, "plugin.growth.presenter");
  assert.equal(presenter.domainId, "growth");
  assert.equal(presenter.spiType, "presenter");
});

test("OperationsPresenter has correct plugin metadata", () => {
  const presenter = createOperationsPresenterPlugin();

  assert.equal(presenter.pluginId, "plugin.operations.presenter");
  assert.equal(presenter.domainId, "operations");
  assert.equal(presenter.spiType, "presenter");
});

test("CodingPresenter capabilityIds include coding capabilities", () => {
  const presenter = createCodingPresenterPlugin();

  assert.ok(presenter.capabilityIds?.includes("present.output"));
  assert.ok(presenter.capabilityIds?.includes("present.diff"));
  assert.ok(presenter.capabilityIds?.includes("present.summary"));
});

test("GrowthPresenter capabilityIds include growth capabilities", () => {
  const presenter = createGrowthPresenterPlugin();

  assert.ok(presenter.capabilityIds?.includes("present.output"));
  assert.ok(presenter.capabilityIds?.includes("present.campaign"));
  assert.ok(presenter.capabilityIds?.includes("present.abtest"));
});

test("OperationsPresenter capabilityIds include operations capabilities", () => {
  const presenter = createOperationsPresenterPlugin();

  assert.ok(presenter.capabilityIds?.includes("present.output"));
  assert.ok(presenter.capabilityIds?.includes("present.incident"));
  assert.ok(presenter.capabilityIds?.includes("present.runbook"));
});

test("CodingPresenter formatOutput handles empty machineOutputs", async () => {
  const presenter = createCodingPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [],
    artifacts: [],
    audience: "developer",
  });

  assert.equal(output.summary, "No coding output produced");
  assert.deepEqual(output.sections, []);
  assert.deepEqual(output.citations, []);
});

test("CodingPresenter formatOutput includes step IDs in summary", async () => {
  const presenter = createCodingPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      { stepId: "step1", outputRef: "ref1", payload: {} },
      { stepId: "step2", outputRef: "ref2", payload: {} },
    ],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(output.summary.includes("2 coding step(s)"));
  assert.ok(output.summary.includes("step1"));
  assert.ok(output.summary.includes("step2"));
});

test("CodingPresenter formatOutput formats payload as JSON", async () => {
  const presenter = createCodingPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "format_test",
        outputRef: "ref1",
        payload: { name: "test", value: 42 },
      },
    ],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(output.sections.length > 0);
  assert.ok(output.sections[0].includes('"name"'));
  assert.ok(output.sections[0].includes("test"));
});

test("CodingPresenter formatOutput includes artifacts in sections", async () => {
  const presenter = createCodingPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      { stepId: "step1", outputRef: "ref1", payload: {} },
    ],
    artifacts: ["artifact:patch", "artifact:test-report"],
    audience: "developer",
  });

  assert.ok(output.sections.some((s) => s.includes("Artifacts")));
  assert.ok(output.sections.some((s) => s.includes("artifact:patch")));
  assert.ok(output.sections.some((s) => s.includes("artifact:test-report")));
});

test("CodingPresenter formatOutput includes artifacts in citations", async () => {
  const presenter = createCodingPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      { stepId: "step1", outputRef: "ref1", payload: {} },
    ],
    artifacts: ["artifact:patch", "artifact:test-report"],
    audience: "developer",
  });

  assert.deepEqual(output.citations, ["artifact:patch", "artifact:test-report"]);
});

test("GrowthPresenter formatOutput handles empty machineOutputs", async () => {
  const presenter = createGrowthPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [],
    artifacts: [],
    audience: "end_user",
  });

  assert.equal(output.summary, "No growth output produced");
  assert.deepEqual(output.sections, []);
});

test("GrowthPresenter formatOutput formats campaign type", async () => {
  const presenter = createGrowthPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "campaign_step",
        outputRef: "campaign_ref",
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

  assert.ok(output.sections.length > 0);
  assert.ok(output.sections[0].includes("Campaign: Summer Sale"));
  assert.ok(output.sections[0].includes("**Reach**: 10000"));
  assert.ok(output.sections[0].includes("**Conversion Rate**: 5%"));
  assert.ok(output.sections[0].includes("**ROAS**: 3.5x"));
});

test("GrowthPresenter formatOutput formats abtest type", async () => {
  const presenter = createGrowthPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "abtest_step",
        outputRef: "abtest_ref",
        payload: {
          type: "abtest",
          testName: "CTA Button Color",
          variant: "blue",
          lift: "12%",
          confidence: "95%",
        },
      },
    ],
    artifacts: [],
    audience: "reviewer",
  });

  assert.ok(output.sections.length > 0);
  assert.ok(output.sections[0].includes("A/B Test: CTA Button Color"));
  assert.ok(output.sections[0].includes("**Winning Variant**: blue"));
  assert.ok(output.sections[0].includes("**Lift**: 12%"));
  assert.ok(output.sections[0].includes("**Confidence**: 95%"));
});

test("GrowthPresenter formatOutput handles generic payload", async () => {
  const presenter = createGrowthPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "generic_step",
        outputRef: "generic_ref",
        payload: { custom: "data", value: 123 },
      },
    ],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(output.sections.length > 0);
  assert.ok(output.sections[0].includes("generic_step"));
  assert.ok(output.sections[0].includes('"custom"'));
});

test("OperationsPresenter formatOutput handles empty machineOutputs", async () => {
  const presenter = createOperationsPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [],
    artifacts: [],
    audience: "operator",
  });

  assert.equal(output.summary, "No operational output produced");
  assert.deepEqual(output.sections, []);
});

test("OperationsPresenter formatOutput formats incident type", async () => {
  const presenter = createOperationsPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "incident_step",
        outputRef: "incident_ref",
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

  assert.ok(output.sections.length > 0);
  assert.ok(output.sections[0].includes("[CRITICAL]"));
  assert.ok(output.sections[0].includes("payment-service"));
  assert.ok(output.sections[0].includes("Payment processing failure"));
});

test("OperationsPresenter formatOutput formats runbook type", async () => {
  const presenter = createOperationsPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "runbook_step",
        outputRef: "runbook_ref",
        payload: {
          type: "runbook",
          title: "Deploy Rollback Procedure",
          steps: [
            "Step 1: Stop the service",
            "Step 2: Revert to previous version",
            "Step 3: Restart the service",
          ],
        },
      },
    ],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(output.sections.length > 0);
  assert.ok(output.sections[0].includes("## Deploy Rollback Procedure"));
  assert.ok(output.sections[0].includes("1. Stop the service"));
  assert.ok(output.sections[0].includes("2. Revert to previous version"));
  assert.ok(output.sections[0].includes("3. Restart the service"));
});

test("OperationsPresenter formatOutput handles generic payload", async () => {
  const presenter = createOperationsPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      {
        stepId: "generic_ops",
        outputRef: "generic_ref",
        payload: { operation: "test", status: "ok" },
      },
    ],
    artifacts: [],
    audience: "operator",
  });

  assert.ok(output.sections.length > 0);
  assert.ok(output.sections[0].includes("generic_ops"));
  assert.ok(output.sections[0].includes("operation"));
});

test("OperationsPresenter formatOutput includes artifacts", async () => {
  const presenter = createOperationsPresenterPlugin();

  const output = await presenter.formatOutput({
    machineOutputs: [
      { stepId: "step1", outputRef: "ref1", payload: {} },
    ],
    artifacts: ["runbook:deployment"],
    audience: "operator",
  });

  assert.ok(output.sections.some((s) => s.includes("Artifacts")));
  assert.ok(output.citations.includes("runbook:deployment"));
});

test("All presenters return HumanOutput structure", async () => {
  const presenters = [
    createCodingPresenterPlugin(),
    createGrowthPresenterPlugin(),
    createOperationsPresenterPlugin(),
  ];

  for (const presenter of presenters) {
    const output = await presenter.formatOutput({
      machineOutputs: [
        { stepId: "test", outputRef: "ref", payload: { test: true } },
      ],
      artifacts: [],
      audience: "developer",
    });

    assert.ok(typeof output.summary === "string");
    assert.ok(Array.isArray(output.sections));
    assert.ok(Array.isArray(output.citations));
  }
});

test("All presenters handle different audiences", async () => {
  const presenters = [
    createCodingPresenterPlugin(),
    createGrowthPresenterPlugin(),
    createOperationsPresenterPlugin(),
  ];

  const audiences: Array<"end_user" | "developer" | "reviewer" | "operator"> = [
    "end_user",
    "developer",
    "reviewer",
    "operator",
  ];

  for (const presenter of presenters) {
    for (const audience of audiences) {
      const output = await presenter.formatOutput({
        machineOutputs: [
          { stepId: "test", outputRef: "ref", payload: {} },
        ],
        artifacts: [],
        audience,
      });

      assert.ok(typeof output.summary === "string");
    }
  }
});

test("All presenters initialize returns undefined", async () => {
  const presenters = [
    createCodingPresenterPlugin(),
    createGrowthPresenterPlugin(),
    createOperationsPresenterPlugin(),
  ];

  for (const presenter of presenters) {
    const result = await presenter.initialize();
    assert.equal(result, undefined);
  }
});

test("All presenters shutdown returns undefined", async () => {
  const presenters = [
    createCodingPresenterPlugin(),
    createGrowthPresenterPlugin(),
    createOperationsPresenterPlugin(),
  ];

  for (const presenter of presenters) {
    const result = await presenter.shutdown();
    assert.equal(result, undefined);
  }
});

test("All presenters healthCheck follows initialize lifecycle", async () => {
  const presenters = [
    createCodingPresenterPlugin(),
    createGrowthPresenterPlugin(),
    createOperationsPresenterPlugin(),
  ];

  for (const presenter of presenters) {
    assert.equal(await presenter.healthCheck(), false);
    await presenter.initialize();
    assert.equal(await presenter.healthCheck(), true);
  }
});
