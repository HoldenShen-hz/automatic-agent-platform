/**
 * E2E Config Drift Tests
 *
 * End-to-end tests covering configuration drift detection and reconciliation:
 * - Detecting drift between baseline and observed configurations
 * - Severity classification (warning vs blocking)
 * - ConfigDriftReconciler reconciliation logic
 * - Drift event emission to event bus
 * - Blocking key enforcement
 *
 * Issue: R15-87 | Missing config-drift e2e tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { ConfigDriftReconciler, type ConfigDriftSource, type ConfigDriftReport } from "../../src/platform/five-plane-control-plane/config-center/config-drift-reconciler.js";
import { DurableEventBus } from "../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";

// ---------------------------------------------------------------------------
// Test 1: Detect drift when observed differs from baseline
// ---------------------------------------------------------------------------

test("E2E Config Drift: detects drift when observed configuration differs", () => {
  const harness = createE2EHarness("aa-e2e-config-drift-");
  try {
    const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

    const baseline: ConfigDriftSource = {
      sourceName: "defaults",
      values: {
        "runtime.maxRetries": 3,
        "runtime.timeoutMs": 60000,
        "security.sandboxMode": "workspace_read",
      },
    };

    const observed: ConfigDriftSource[] = [
      {
        sourceName: "environment",
        values: {
          "runtime.maxRetries": 5, // Changed
          "runtime.timeoutMs": 60000, // Same
          "security.sandboxMode": "workspace_read", // Same
        },
      },
    ];

    const report = reconciler.reconcile({
      baseline,
      observed,
      generatedAt: new Date().toISOString(),
    });

    assert.ok(report.findings.length > 0, "Should detect drift");
    const maxRetriesFinding = report.findings.find(f => f.key === "runtime.maxRetries");
    assert.ok(maxRetriesFinding, "Should find drift for runtime.maxRetries");
    assert.equal(maxRetriesFinding!.expectedValue, 3);
    assert.equal(maxRetriesFinding!.observedValue, 5);
    assert.equal(maxRetriesFinding!.severity, "warning");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: No drift when configurations match
// ---------------------------------------------------------------------------

test("E2E Config Drift: no findings when configurations match", () => {
  const harness = createE2EHarness("aa-e2e-config-drift-match-");
  try {
    const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

    const baseline: ConfigDriftSource = {
      sourceName: "defaults",
      values: {
        "providers.defaultProvider": "openai",
        "providers.defaultModel": "gpt-4",
      },
    };

    const observed: ConfigDriftSource[] = [
      {
        sourceName: "environment",
        values: {
          "providers.defaultProvider": "openai",
          "providers.defaultModel": "gpt-4",
        },
      },
    ];

    const report = reconciler.reconcile({
      baseline,
      observed,
      generatedAt: new Date().toISOString(),
    });

    assert.equal(report.findings.length, 0, "Should have no findings");
    assert.equal(report.blocking, false, "Should not be blocking");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Blocking drift when key is in blocking keys
// ---------------------------------------------------------------------------

test("E2E Config Drift: blocking severity for keys in blockingKeys", () => {
  const harness = createE2EHarness("aa-e2e-config-drift-blocking-");
  try {
    const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

    const baseline: ConfigDriftSource = {
      sourceName: "defaults",
      values: {
        "security.allowDestructiveActions": false,
        "runtime.maxRetries": 3,
      },
    };

    const observed: ConfigDriftSource[] = [
      {
        sourceName: "runtime",
        values: {
          "security.allowDestructiveActions": true, // Changed - dangerous!
          "runtime.maxRetries": 3,
        },
      },
    ];

    const report = reconciler.reconcile({
      baseline,
      observed,
      blockingKeys: ["security.allowDestructiveActions"],
      generatedAt: new Date().toISOString(),
    });

    const destructiveFinding = report.findings.find(f => f.key === "security.allowDestructiveActions");
    assert.ok(destructiveFinding, "Should find drift for security key");
    assert.equal(destructiveFinding!.severity, "blocking", "Should be blocking severity");
    assert.equal(report.blocking, true, "Report should be blocking");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Multiple observed sources are checked
// ---------------------------------------------------------------------------

test("E2E Config Drift: checks multiple observed sources", () => {
  const harness = createE2EHarness("aa-e2e-config-drift-multi-");
  try {
    const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

    const baseline: ConfigDriftSource = {
      sourceName: "defaults",
      values: {
        "runtime.concurrencyLimit": 100,
        "gateways.timeoutMs": 5000,
      },
    };

    const observed: ConfigDriftSource[] = [
      {
        sourceName: "environment",
        values: {
          "runtime.concurrencyLimit": 100,
          "gateways.timeoutMs": 5000,
        },
      },
      {
        sourceName: "runtime",
        values: {
          "runtime.concurrencyLimit": 150, // Drift from runtime
          "gateways.timeoutMs": 5000,
        },
      },
    ];

    const report = reconciler.reconcile({
      baseline,
      observed,
      generatedAt: new Date().toISOString(),
    });

    const concurrencyFinding = report.findings.find(f => f.key === "runtime.concurrencyLimit");
    assert.ok(concurrencyFinding, "Should find drift");
    assert.equal(concurrencyFinding!.observedSource, "runtime", "Should attribute to runtime source");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Null observed value is detected as drift
// ---------------------------------------------------------------------------

test("E2E Config Drift: detects drift when observed value is null", () => {
  const harness = createE2EHarness("aa-e2e-config-drift-null-");
  try {
    const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

    const baseline: ConfigDriftSource = {
      sourceName: "defaults",
      values: {
        "providers.defaultModel": "gpt-4",
      },
    };

    const observed: ConfigDriftSource[] = [
      {
        sourceName: "environment",
        values: {
          "providers.defaultModel": null as unknown as string, // Null value
        },
      },
    ];

    const report = reconciler.reconcile({
      baseline,
      observed,
      generatedAt: new Date().toISOString(),
    });

    const finding = report.findings.find(f => f.key === "providers.defaultModel");
    assert.ok(finding, "Should find drift");
    assert.equal(finding!.observedValue, null);

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: Drift report includes generation timestamp
// ---------------------------------------------------------------------------

test("E2E Config Drift: report includes generatedAt timestamp", () => {
  const harness = createE2EHarness("aa-e2e-config-drift-time-");
  try {
    const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

    const baseline: ConfigDriftSource = {
      sourceName: "defaults",
      values: { "runtime.maxRetries": 3 },
    };

    const observed: ConfigDriftSource[] = [
      { sourceName: "environment", values: { "runtime.maxRetries": 5 } },
    ];

    const now = new Date().toISOString();
    const report = reconciler.reconcile({
      baseline,
      observed,
      generatedAt: now,
    });

    assert.equal(report.generatedAt, now, "Should preserve generatedAt");
    assert.equal(report.baselineSource, "defaults", "Should record baseline source");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 7: Blocking report when any finding is blocking
// ---------------------------------------------------------------------------

test("E2E Config Drift: report is blocking when any finding is blocking", () => {
  const harness = createE2EHarness("aa-e2e-config-drift-any-block-");
  try {
    const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

    const baseline: ConfigDriftSource = {
      sourceName: "defaults",
      values: {
        "security.allowDestructiveActions": false,
        "runtime.maxRetries": 3,
      },
    };

    const observed: ConfigDriftSource[] = [
      {
        sourceName: "environment",
        values: {
          "security.allowDestructiveActions": true, // Blocking
          "runtime.maxRetries": 5, // Warning only
        },
      },
    ];

    const report = reconciler.reconcile({
      baseline,
      observed,
      blockingKeys: ["security.allowDestructiveActions"],
      generatedAt: new Date().toISOString(),
    });

    assert.equal(report.blocking, true, "Should be blocking when any finding is blocking");
    assert.ok(report.findings.length >= 1, "Should have findings");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 8: Empty observed sources produces empty report
// ---------------------------------------------------------------------------

test("E2E Config Drift: empty observed sources produces empty report", () => {
  const harness = createE2EHarness("aa-e2e-config-drift-empty-");
  try {
    const reconciler = new ConfigDriftReconciler({ emitIncidents: false });

    const baseline: ConfigDriftSource = {
      sourceName: "defaults",
      values: {
        "runtime.timeoutMs": 60000,
      },
    };

    const report = reconciler.reconcile({
      baseline,
      observed: [],
      generatedAt: new Date().toISOString(),
    });

    assert.equal(report.findings.length, 0, "Should have no findings");
    assert.equal(report.blocking, false, "Should not be blocking");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E Config Drift Tests
// ---------------------------------------------------------------------------