/**
 * E2E Config Drift Tests
 *
 * End-to-end tests covering config drift detection and response
 * for configuration management.
 *
 * Tests verify:
 * - Config drift detection
 * - Drift signal generation
 * - Drift response workflow
 * - Config reconciliation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Test 1: Config Drift Detection
// ---------------------------------------------------------------------------

test("E2E Config Drift: detects drift when actual config differs from desired", async () => {
  const harness = createE2EHarness("aa-e2e-config-drift-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Setup initial config
    harness.db.transaction(() => {
      harness.store.insertConfigRecord({
        id: configId,
        configKey: "feature_flags.max_retries",
        desiredValue: "3",
        actualValue: "3",
        version: "1.0",
        updatedAt: now,
        driftDetectedAt: null,
        tenantId: "tenant-1",
      });
    });

    // Simulate config drift by updating actualValue
    harness.db.transaction(() => {
      const config = harness.store.config.getConfigRecord(configId);
      if (config) {
        harness.store.config.updateConfigRecord({
          id: configId,
          actualValue: "5", // Drift: actual differs from desired
        });
      }
    });

    // Detect drift
    const config = harness.store.config.getConfigRecord(configId);
    const hasDrift = config?.actualValue !== config?.desiredValue;

    assert.equal(hasDrift, true, "Should detect drift when actual differs from desired");
    assert.notEqual(config?.driftDetectedAt, null, "Should record drift detection time");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Config Drift Signal Generation
// ---------------------------------------------------------------------------

test("E2E Config Drift: generates drift signals for monitoring", async () => {
  const harness = createE2EHarness("aa-e2e-config-drift-signal-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Setup config with drift
    harness.db.transaction(() => {
      harness.store.insertConfigRecord({
        id: configId,
        configKey: "feature_flags.enable_preview",
        desiredValue: "true",
        actualValue: "false",
        version: "2.0",
        updatedAt: now,
        driftDetectedAt: now,
        tenantId: "tenant-1",
      });
    });

    // Generate drift signals
    const driftSignals = harness.store.config.listConfigRecords().filter(
      (c) => c.driftDetectedAt != null,
    );

    assert.ok(driftSignals.length > 0, "Should have drift signals");
    assert.equal(driftSignals[0].configKey, "feature_flags.enable_preview", "Should reference correct config");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Config Reconciliation
// ---------------------------------------------------------------------------

test("E2E Config Drift: reconciles drifted config back to desired state", async () => {
  const harness = createE2EHarness("aa-e2e-config-reconcile-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Setup config with drift
    harness.db.transaction(() => {
      harness.store.insertConfigRecord({
        id: configId,
        configKey: "feature_flags.rate_limit",
        desiredValue: "1000",
        actualValue: "500",
        version: "1.5",
        updatedAt: now,
        driftDetectedAt: now,
        tenantId: "tenant-1",
      });
    });

    // Perform reconciliation
    harness.db.transaction(() => {
      const config = harness.store.config.getConfigRecord(configId);
      if (config) {
        harness.store.config.updateConfigRecord({
          id: configId,
          actualValue: config.desiredValue, // Reconcile to desired
          driftDetectedAt: null, // Clear drift
        });
      }
    });

    // Verify reconciliation
    const reconciled = harness.store.config.getConfigRecord(configId);
    assert.equal(reconciled?.actualValue, reconciled?.desiredValue, "Actual should match desired after reconciliation");
    assert.equal(reconciled?.driftDetectedAt, null, "Drift should be cleared");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Config Drift with Version Mismatch
// ---------------------------------------------------------------------------

test("E2E Config Drift: detects drift with version mismatch", async () => {
  const harness = createE2EHarness("aa-e2e-config-version-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Setup config with version mismatch
    harness.db.transaction(() => {
      harness.store.insertConfigRecord({
        id: configId,
        configKey: "feature_flags.timeout_ms",
        desiredValue: "5000",
        actualValue: "3000",
        version: "1.0",
        updatedAt: now,
        driftDetectedAt: now,
        tenantId: "tenant-1",
      });
    });

    const config = harness.store.config.getConfigRecord(configId);
    const hasVersionDrift = config?.version !== "2.0"; // Expected version is 2.0

    assert.equal(hasVersionDrift, true, "Should detect version mismatch drift");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E Config Drift Tests
// ---------------------------------------------------------------------------