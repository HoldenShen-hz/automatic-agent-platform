/**
 * Unit tests for ConfigDriftReconciler
 *
 * Tests configuration drift detection and incident emission per §24.2/R15-77.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigDriftReconciler,
  type ConfigDriftSource,
  type ConfigDriftReport,
  type ConfigDriftFinding,
} from "../../../../../src/platform/control-plane/config-center/config-drift-reconciler.js";

test("ConfigDriftReconciler.reconcile detects drift between baseline and observed", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { timeout: 30000, logLevel: "info" },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: { timeout: 60000, logLevel: "info" },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  assert.ok(report.findings.length > 0);
  assert.strictEqual(report.baselineSource, "defaults");
  assert.ok(report.findings.some(f => f.key === "timeout"));
});

test("ConfigDriftReconciler.reconcile marks security-sensitive keys as blocking", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { sandboxMode: "permissive" },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: { sandboxMode: "strict" },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  assert.ok(report.blocking);
  const sandboxFinding = report.findings.find(f => f.key === "sandboxMode");
  assert.ok(sandboxFinding);
  assert.strictEqual(sandboxFinding.severity, "blocking");
});

test("ConfigDriftReconciler.reconcile marks budget/egress-sensitive keys as blocking", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { "budget.limit": 1000 },
  };
  const observed: ConfigDriftSource = {
    sourceName: "environment",
    values: { "budget.limit": 2000 },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  assert.ok(report.blocking);
  const budgetFinding = report.findings.find(f => f.key === "budget.limit");
  assert.ok(budgetFinding);
  assert.strictEqual(budgetFinding.severity, "blocking");
});

test("ConfigDriftReconciler.reconcile marks sandbox-sensitive keys as blocking", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { "sandbox.mode": "workspace" },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: { "sandbox.mode": "none" },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  assert.ok(report.blocking);
  const sandboxFinding = report.findings.find(f => f.key === "sandbox.mode");
  assert.ok(sandboxFinding);
  assert.strictEqual(sandboxFinding.severity, "blocking");
});

test("ConfigDriftReconciler.reconcile marks user-specified blocking keys as blocking", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { customKey: "old" },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: { customKey: "new" },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    blockingKeys: ["customKey"],
    generatedAt: new Date().toISOString(),
  });

  assert.ok(report.blocking);
  const customFinding = report.findings.find(f => f.key === "customKey");
  assert.ok(customFinding);
  assert.strictEqual(customFinding.severity, "blocking");
});

test("ConfigDriftReconciler.reconcile marks non-sensitive keys as warning", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { logLevel: "info" },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: { logLevel: "debug" },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  assert.ok(!report.blocking);
  const logFinding = report.findings.find(f => f.key === "logLevel");
  assert.ok(logFinding);
  assert.strictEqual(logFinding.severity, "warning");
});

test("ConfigDriftReconciler.reconcile handles no drift gracefully", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { timeout: 30000 },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: { timeout: 30000 },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  assert.strictEqual(report.findings.length, 0);
  assert.ok(!report.blocking);
});

test("ConfigDriftReconciler.reconcile reports observed value as null when key is missing", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { timeout: 30000 },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: {}, // timeout key is missing
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  assert.strictEqual(report.findings.length, 1);
  const finding = report.findings[0];
  assert.strictEqual(finding.key, "timeout");
  assert.strictEqual(finding.expectedValue, 30000);
  assert.strictEqual(finding.observedValue, null);
});

test("ConfigDriftReconciler.reconcile includes correct observed source in findings", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { timeout: 30000 },
  };
  const observed: ConfigDriftSource = {
    sourceName: "environment",
    values: { timeout: 60000 },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  const finding = report.findings[0];
  assert.strictEqual(finding.observedSource, "environment");
});

test("ConfigDriftReconciler constructor accepts options", () => {
  const reconciler = new ConfigDriftReconciler({
    incidentSeverityThreshold: "blocking",
  });

  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { logLevel: "info" },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: { logLevel: "debug" },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  // With threshold "blocking", warning-level findings should not trigger incident
  // but the findings should still be present
  assert.ok(report.findings.length > 0);
  assert.ok(!report.blocking);
});

test("ConfigDriftReconciler.reconcile checks multiple observed sources", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { timeout: 30000 },
  };
  const observed1: ConfigDriftSource = {
    sourceName: "environment",
    values: { timeout: 30000 }, // no drift
  };
  const observed2: ConfigDriftSource = {
    sourceName: "runtime",
    values: { timeout: 60000 }, // drift
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed1, observed2],
    generatedAt: new Date().toISOString(),
  });

  assert.strictEqual(report.findings.length, 1);
  const finding = report.findings[0];
  assert.strictEqual(finding.observedSource, "runtime");
});

test("ConfigDriftReconciler.reconcile handles empty baseline", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: {},
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: { timeout: 60000 },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  // With empty baseline, no comparisons are made (empty baseline has no keys to compare)
  assert.strictEqual(report.findings.length, 0);
});

test("ConfigDriftReconciler.reconcile handles empty observed values", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { key1: "value1", key2: "value2" },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: {},
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  assert.strictEqual(report.findings.length, 2);
});

test("ConfigDriftReconciler reports correct generatedAt timestamp", () => {
  const reconciler = new ConfigDriftReconciler();
  const timestamp = new Date().toISOString();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { timeout: 30000 },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: { timeout: 60000 },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: timestamp,
  });

  assert.strictEqual(report.generatedAt, timestamp);
});

test("ConfigDriftReconciler sets blocking flag when any finding is blocking", () => {
  const reconciler = new ConfigDriftReconciler();
  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { logLevel: "info", sandboxMode: "permissive" },
  };
  const observed: ConfigDriftSource = {
    sourceName: "runtime",
    values: { logLevel: "debug", sandboxMode: "strict" },
  };

  const report = reconciler.reconcile({
    baseline,
    observed: [observed],
    generatedAt: new Date().toISOString(),
  });

  assert.ok(report.blocking);
  assert.ok(report.findings.some(f => f.severity === "warning"));
  assert.ok(report.findings.some(f => f.severity === "blocking"));
});
