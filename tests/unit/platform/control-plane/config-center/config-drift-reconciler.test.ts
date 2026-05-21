import assert from "node:assert/strict";
import test from "node:test";
import { ConfigDriftReconciler, type ConfigDriftSource } from "../../../../../src/platform/five-plane-control-plane/config-center/config-drift-reconciler.js";

test("ConfigDriftReconciler reconcile detects no drift when values match", () => {
  const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { maxConcurrentTasks: 10, timeoutMs: 30000 },
  };
  const observed: readonly ConfigDriftSource[] = [
    {
      sourceName: "runtime",
      values: { maxConcurrentTasks: 10, timeoutMs: 30000 },
    },
  ];

  const report = reconciler.reconcile({
    baseline,
    observed,
    generatedAt: new Date().toISOString(),
  });

  assert.equal(report.findings.length, 0);
  assert.equal(report.blocking, false);
});

test("ConfigDriftReconciler reconcile detects drift when values differ", () => {
  const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { maxConcurrentTasks: 10 },
  };
  const observed: readonly ConfigDriftSource[] = [
    {
      sourceName: "runtime",
      values: { maxConcurrentTasks: 5 },
    },
  ];

  const report = reconciler.reconcile({
    baseline,
    observed,
    generatedAt: new Date().toISOString(),
  });

  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.key, "maxConcurrentTasks");
  assert.equal(report.findings[0]!.expectedValue, 10);
  assert.equal(report.findings[0]!.observedValue, 5);
  assert.equal(report.findings[0]!.observedSource, "runtime");
  assert.equal(report.findings[0]!.severity, "warning");
});

test("ConfigDriftReconciler reconcile marks blocking keys as blocking severity", () => {
  const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { approvalMode: "supervised", maxConcurrentTasks: 10 },
  };
  const observed: readonly ConfigDriftSource[] = [
    {
      sourceName: "runtime",
      values: { approvalMode: " unsupervised", maxConcurrentTasks: 10 },
    },
  ];

  const report = reconciler.reconcile({
    baseline,
    observed,
    blockingKeys: ["approvalMode"],
    generatedAt: new Date().toISOString(),
  });

  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.severity, "blocking");
  assert.equal(report.blocking, true);
});

test("ConfigDriftReconciler reconcile handles multiple observed sources", () => {
  const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { a: 1, b: 2, c: 3 },
  };
  const observed: readonly ConfigDriftSource[] = [
    { sourceName: "environment", values: { a: 1, b: 99, c: 3 } },
    { sourceName: "runtime", values: { a: 1, b: 2, c: 3 } },
  ];

  const report = reconciler.reconcile({
    baseline,
    observed,
    generatedAt: new Date().toISOString(),
  });

  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.key, "b");
  assert.equal(report.findings[0]!.observedSource, "environment");
});

test("ConfigDriftReconciler reconcile handles missing values in observed", () => {
  const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

  const baseline: ConfigDriftSource = {
    sourceName: "defaults",
    values: { a: 1, b: 2 },
  };
  const observed: readonly ConfigDriftSource[] = [
    { sourceName: "runtime", values: { a: 1 } },
  ];

  const report = reconciler.reconcile({
    baseline,
    observed,
    generatedAt: new Date().toISOString(),
  });

  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.key, "b");
  assert.equal(report.findings[0]!.observedValue, null);
});

test("ConfigDriftReconciler constructor allows disabling incident emission", () => {
  const reconciler = new ConfigDriftReconciler({ emitIncidents: false });
  assert.ok(reconciler != null);
});

test("ConfigDriftReconciler constructor allows providing eventBus", () => {
  const reconciler = new ConfigDriftReconciler({ emitIncidents: true, eventBus: null });
  assert.ok(reconciler != null);
});
