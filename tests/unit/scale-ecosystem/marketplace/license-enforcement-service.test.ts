import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { LicenseEnforcementService } from "../../../../src/scale-ecosystem/marketplace/license-enforcement-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "license-enforcement.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new LicenseEnforcementService(store);
  return { workspace, db, store, service };
}

test("LicenseEnforcementService allows feature access when enforcement is disabled", () => {
  const harness = createHarness("aa-license-disabled-");
  try {
    harness.service.setEnabled(false);
    const result = harness.service.checkFeatureAccess("admin_console", "community");
    assert.equal(result.allowed, true);
    assert.equal(result.action, "allow");
    assert.equal(result.reason, "enforcement_disabled");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService denies access when tier is insufficient in strict mode", () => {
  const harness = createHarness("aa-license-strict-");
  try {
    harness.service.setStrictMode(true);
    const result = harness.service.checkFeatureAccess("sso", "professional");
    assert.equal(result.allowed, false);
    assert.equal(result.action, "deny");
    assert.equal(result.tierRequired, "enterprise");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService warns but allows access when tier is insufficient in non-strict mode", () => {
  const harness = createHarness("aa-license-warn-");
  try {
    harness.service.setStrictMode(false);
    const result = harness.service.checkFeatureAccess("sso", "professional");
    assert.equal(result.allowed, false);
    assert.equal(result.action, "warn");
    assert.equal(result.tierRequired, "enterprise");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService records feature usage and meters consumption", () => {
  const harness = createHarness("aa-license-meter-");
  try {
    // Record usage for a metered feature
    harness.service.recordFeatureUsage("audit_export", {
      accountId: "acct_1",
    });

    // Check usage was recorded
    const usage = harness.service.getFeatureUsage("audit_export", {
      accountId: "acct_1",
    });
    assert.equal(usage?.count, 1);
    assert.equal(usage?.limit, 1000);

    // Record more usage
    harness.service.recordFeatureUsage("audit_export", {
      accountId: "acct_1",
    });
    const usage2 = harness.service.getFeatureUsage("audit_export", {
      accountId: "acct_1",
    });
    assert.equal(usage2?.count, 2);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService denies access when usage limit is exceeded", () => {
  const harness = createHarness("aa-license-limit-");
  try {
    // Register a feature gate with a low limit
    harness.service.registerFeatureGate({
      featureKey: "test_feature",
      requiredTier: "community",
      enabled: true,
      meterUsage: true,
      usageLimit: 2,
      usageWindowMs: 24 * 60 * 60 * 1000,
      warnThreshold: 0.8,
    });

    // Record usage up to the limit
    harness.service.recordFeatureUsage("test_feature");
    harness.service.recordFeatureUsage("test_feature");

    // Now access should be denied
    const result = harness.service.checkFeatureAccess("test_feature", "community");
    assert.equal(result.allowed, false);
    assert.match(result.reason, /usage_limit_exceeded/);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService warns when usage approaches limit threshold", () => {
  const harness = createHarness("aa-license-warn-threshold-");
  try {
    // Register a feature gate with a low limit and low warn threshold
    harness.service.registerFeatureGate({
      featureKey: "threshold_feature",
      requiredTier: "community",
      enabled: true,
      meterUsage: true,
      usageLimit: 10,
      usageWindowMs: 24 * 60 * 60 * 1000,
      warnThreshold: 0.5,
    });

    // Record usage to hit the 50% threshold
    for (let i = 0; i < 5; i++) {
      harness.service.recordFeatureUsage("threshold_feature");
    }

    const result = harness.service.checkFeatureAccess("threshold_feature", "community");
    assert.equal(result.allowed, true);
    assert.equal(result.action, "warn");
    assert.ok((result.metadata?.usageRatio as number) >= 0.5);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService tracks violations and returns them", () => {
  const harness = createHarness("aa-license-violation-");
  try {
    harness.service.setStrictMode(true);

    // Trigger violations
    harness.service.checkFeatureAccess("sso", "professional");
    harness.service.checkFeatureAccess("scim", "community");

    const violations = harness.service.getViolations();
    assert.ok(violations.length >= 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService enables and disables feature gates", () => {
  const harness = createHarness("aa-license-gate-toggle-");
  try {
    // admin_console is enabled by default
    const result1 = harness.service.checkFeatureAccess("admin_console", "community");
    assert.equal(result1.allowed, true);

    // Disable it
    const disabled = harness.service.disableFeatureGate("admin_console");
    assert.equal(disabled, true);

    const result2 = harness.service.checkFeatureAccess("admin_console", "community");
    assert.equal(result2.allowed, false);

    // Re-enable it
    const enabled = harness.service.enableFeatureGate("admin_console");
    assert.equal(enabled, true);

    const result3 = harness.service.checkFeatureAccess("admin_console", "community");
    assert.equal(result3.allowed, true);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService lists and retrieves feature gates", () => {
  const harness = createHarness("aa-license-list-gates-");
  try {
    const gates = harness.service.listFeatureGates();
    assert.ok(gates.length > 0);
    assert.ok(gates.some((gate) => gate.featureKey === "admin_console"));

    const ssoGate = harness.service.getFeatureGate("sso");
    assert.equal(ssoGate?.requiredTier, "enterprise");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService resets meters correctly", () => {
  const harness = createHarness("aa-license-reset-meter-");
  try {
    harness.service.recordFeatureUsage("audit_export", { accountId: "acct_reset" });
    harness.service.recordFeatureUsage("audit_export", { accountId: "acct_reset" });

    let usage = harness.service.getFeatureUsage("audit_export", { accountId: "acct_reset" });
    assert.equal(usage?.count, 2);

    // Reset the meter
    const reset = harness.service.resetMeter("audit_export", { accountId: "acct_reset" });
    assert.equal(reset, true);

    usage = harness.service.getFeatureUsage("audit_export", { accountId: "acct_reset" });
    assert.equal(usage?.count, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService lists active meters", () => {
  const harness = createHarness("aa-license-list-meters-");
  try {
    harness.service.recordFeatureUsage("audit_export", { accountId: "acct_meters_1" });
    harness.service.recordFeatureUsage("incident_console", { accountId: "acct_meters_2" });

    const meters = harness.service.listActiveMeters();
    assert.ok(meters.length >= 2);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService respects tier ordering for compareTier", () => {
  const harness = createHarness("aa-license-tier-compare-");
  try {
    // Enterprise > Professional > Community
    const enterpriseAccess = harness.service.checkFeatureAccess("sso", "enterprise");
    assert.equal(enterpriseAccess.allowed, true);

    const communityAccess = harness.service.checkFeatureAccess("sso", "community");
    assert.equal(communityAccess.allowed, false);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService returns config and mode status", () => {
  const harness = createHarness("aa-license-config-");
  try {
    assert.equal(harness.service.isEnabled(), true);
    assert.equal(harness.service.isStrictMode(), false);

    harness.service.setEnabled(false);
    harness.service.setStrictMode(true);

    assert.equal(harness.service.isEnabled(), false);
    assert.equal(harness.service.isStrictMode(), true);

    const config = harness.service.getConfig();
    assert.equal(config.enabled, false);
    assert.equal(config.strictMode, true);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("LicenseEnforcementService updateFeatureLimit modifies gate limits", () => {
  const harness = createHarness("aa-license-update-limit-");
  try {
    const originalGate = harness.service.getFeatureGate("audit_export");
    assert.equal(originalGate?.usageLimit, 1000);

    const updated = harness.service.updateFeatureLimit("audit_export", 500, 60 * 60 * 1000);
    assert.equal(updated, true);

    const updatedGate = harness.service.getFeatureGate("audit_export");
    assert.equal(updatedGate?.usageLimit, 500);
    assert.equal(updatedGate?.usageWindowMs, 60 * 60 * 1000);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
