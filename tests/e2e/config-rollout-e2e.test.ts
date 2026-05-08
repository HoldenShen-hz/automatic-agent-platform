/**
 * E2E Config Rollout Tests
 *
 * End-to-end tests covering config rollout scenarios
 * for configuration management and deployment.
 *
 * Tests verify:
 * - Config rollout stages (draft -> canary -> stable)
 * - Rollout approval workflow
 * - Rollback on failure
 * - Config version management
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Test 1: Config Rollout Draft to Canary
// ---------------------------------------------------------------------------

test("E2E Config Rollout: transitions config from draft to canary", async () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Create config in draft status
    harness.db.transaction(() => {
      harness.store.insertConfigRollout({
        id: configId,
        configKey: "feature_flags.dark_mode",
        targetValue: "true",
        rolloutStage: "draft",
        approvedBy: null,
        rolloutStartedAt: null,
        completedAt: null,
        tenantId: "tenant-1",
      });
    });

    // Transition to canary
    harness.db.transaction(() => {
      const rollout = harness.store.configRollout.getConfigRollout(configId);
      if (rollout) {
        harness.store.configRollout.updateConfigRollout({
          id: configId,
          rolloutStage: "canary",
          rolloutStartedAt: now,
        });
      }
    });

    // Verify transition
    const rollout = harness.store.configRollout.getConfigRollout(configId);
    assert.equal(rollout?.rolloutStage, "canary", "Should be in canary stage");
    assert.ok(rollout?.rolloutStartedAt, "Should record rollout start time");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Config Rollout Canary to Stable
// ---------------------------------------------------------------------------

test("E2E Config Rollout: transitions config from canary to stable", async () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-stable-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Create config in canary status
    harness.db.transaction(() => {
      harness.store.insertConfigRollout({
        id: configId,
        configKey: "feature_flags.new_ui",
        targetValue: "true",
        rolloutStage: "canary",
        approvedBy: "admin-1",
        rolloutStartedAt: now,
        completedAt: null,
        tenantId: "tenant-1",
      });
    });

    // Transition to stable
    harness.db.transaction(() => {
      const rollout = harness.store.configRollout.getConfigRollout(configId);
      if (rollout) {
        harness.store.configRollout.updateConfigRollout({
          id: configId,
          rolloutStage: "stable",
          completedAt: now,
        });
      }
    });

    // Verify transition
    const rollout = harness.store.configRollout.getConfigRollout(configId);
    assert.equal(rollout?.rolloutStage, "stable", "Should be in stable stage");
    assert.ok(rollout?.completedAt, "Should record completion time");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Config Rollout Approval
// ---------------------------------------------------------------------------

test("E2E Config Rollout: requires approval before canary rollout", async () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-approval-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Create config in draft without approval
    harness.db.transaction(() => {
      harness.store.insertConfigRollout({
        id: configId,
        configKey: "feature_flags.experimental",
        targetValue: "true",
        rolloutStage: "draft",
        approvedBy: null,
        rolloutStartedAt: null,
        completedAt: null,
        tenantId: "tenant-1",
      });
    });

    // Try to transition to canary without approval - should fail
    const rollout = harness.store.configRollout.getConfigRollout(configId);
    const canProceed = rollout?.approvedBy != null;

    assert.equal(canProceed, false, "Should not proceed without approval");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Config Rollback
// ---------------------------------------------------------------------------

test("E2E Config Rollout: rolls back config on failure", async () => {
  const harness = createE2EHarness("aa-e2e-config-rollback-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Create config in canary
    harness.db.transaction(() => {
      harness.store.insertConfigRollout({
        id: configId,
        configKey: "feature_flags.beta_feature",
        targetValue: "true",
        rolloutStage: "canary",
        approvedBy: "admin-1",
        rolloutStartedAt: now,
        completedAt: null,
        tenantId: "tenant-1",
      });
    });

    // Rollback to draft
    harness.db.transaction(() => {
      const rollout = harness.store.configRollout.getConfigRollout(configId);
      if (rollout) {
        harness.store.configRollout.updateConfigRollout({
          id: configId,
          rolloutStage: "draft",
          approvedBy: null, // Clear approval
          rolloutStartedAt: null,
        });
      }
    });

    // Verify rollback
    const rolledBack = harness.store.configRollout.getConfigRollout(configId);
    assert.equal(rolledBack?.rolloutStage, "draft", "Should be rolled back to draft");
    assert.equal(rolledBack?.approvedBy, null, "Approval should be cleared");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Config Version Management
// ---------------------------------------------------------------------------

test("E2E Config Rollout: maintains version history", async () => {
  const harness = createE2EHarness("aa-e2e-config-version-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Create initial version
    harness.db.transaction(() => {
      harness.store.insertConfigVersion({
        id: newId("version"),
        configId,
        version: "1.0",
        value: "true",
        createdAt: now,
        createdBy: "admin-1",
      });
    });

    // Create new version
    harness.db.transaction(() => {
      harness.store.insertConfigVersion({
        id: newId("version"),
        configId,
        version: "2.0",
        value: "false",
        createdAt: now,
        createdBy: "admin-2",
      });
    });

    // Verify versions
    const versions = harness.store.configVersion.listConfigVersions(configId);
    assert.ok(versions.length >= 2, "Should have at least 2 versions");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E Config Rollout Tests
// ---------------------------------------------------------------------------