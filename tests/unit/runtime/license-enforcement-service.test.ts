import assert from "node:assert/strict";
import test from "node:test";

import { LicenseEnforcementService } from "../../../src/scale-ecosystem/marketplace/license-enforcement-service.js";
import { createTempWorkspace, cleanupPath } from "../../helpers/fs.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { join } from "node:path";

function createService() {
  const workspace = createTempWorkspace("aa-license-");
  const db = new SqliteDatabase(join(workspace, "license-test.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new LicenseEnforcementService(store);
  return { workspace, db, store, service };
}

test("checkFeatureAccess allows professional feature for enterprise tier [license-enforcement-service]", () => {
  const h = createService();
  try {
    const result = h.service.checkFeatureAccess("sso", "enterprise");
    assert.equal(result.allowed, true);
    assert.equal(result.tierRequired, "enterprise");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("checkFeatureAccess denies enterprise feature for professional tier [license-enforcement-service]", () => {
  const h = createService();
  try {
    // In non-strict mode, insufficient tier returns "warn" not "deny"
    const result = h.service.checkFeatureAccess("sso", "professional");
    assert.equal(result.allowed, false);
    assert.equal(result.action, "warn");
    assert.equal(result.tierRequired, "enterprise");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("checkFeatureAccess allows professional feature for professional tier [license-enforcement-service]", () => {
  const h = createService();
  try {
    const result = h.service.checkFeatureAccess("admin_console", "professional");
    assert.equal(result.allowed, true);
    assert.equal(result.tierRequired, "professional");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("checkFeatureAccess denies professional feature for community tier [license-enforcement-service]", () => {
  const h = createService();
  try {
    const result = h.service.checkFeatureAccess("admin_console", "community");
    assert.equal(result.allowed, false);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("checkFeatureAccess warns in non-strict mode when tier insufficient [license-enforcement-service]", () => {
  const h = createService();
  try {
    const result = h.service.checkFeatureAccess("sso", "professional");
    assert.equal(result.allowed, false);
    assert.equal(result.action, "warn");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("checkFeatureAccess denies in strict mode when tier insufficient [license-enforcement-service]", () => {
  const h = createService();
  try {
    const strictService = new LicenseEnforcementService(h.store, { strictMode: true });
    const result = strictService.checkFeatureAccess("sso", "professional");
    assert.equal(result.allowed, false);
    assert.equal(result.action, "deny");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("checkFeatureAccess allows all when enforcement disabled [license-enforcement-service]", () => {
  const h = createService();
  try {
    const disabledService = new LicenseEnforcementService(h.store, { enabled: false });
    const result = disabledService.checkFeatureAccess("sso", "community");
    assert.equal(result.allowed, true);
    assert.equal(result.reason, "enforcement_disabled");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("recordFeatureUsage increments meter [license-enforcement-service]", () => {
  const h = createService();
  try {
    h.service.recordFeatureUsage("audit_export");
    h.service.recordFeatureUsage("audit_export");

    const usage = h.service.getFeatureUsage("audit_export");
    assert.ok(usage);
    assert.equal(usage!.count, 2);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("getFeatureUsage returns null for non-metered feature [license-enforcement-service]", () => {
  const h = createService();
  try {
    const usage = h.service.getFeatureUsage("admin_console");
    assert.equal(usage, null);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("exceeding usage limit denies access [license-enforcement-service]", () => {
  const h = createService();
  try {
    // Create service with very low limit
    const limitedService = new LicenseEnforcementService(h.store);
    limitedService.updateFeatureLimit("audit_export", 2, 24 * 60 * 60 * 1000);

    // Use up the limit
    limitedService.recordFeatureUsage("audit_export");
    limitedService.recordFeatureUsage("audit_export");

    // Next check should be denied
    const result = limitedService.checkFeatureAccess("audit_export", "enterprise");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes("usage_limit_exceeded"));
  } finally {
    cleanupPath(h.workspace);
  }
});

test("violations are recorded [license-enforcement-service]", () => {
  const h = createService();
  try {
    h.service.checkFeatureAccess("sso", "professional"); // Should be denied

    const violations = h.service.getViolations();
    assert.ok(violations.length > 0);
    const ssoViolation = violations.find((v) => v.capability === "sso");
    assert.ok(ssoViolation);
    assert.equal(ssoViolation!.action, "warn");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("feature gates can be enabled and disabled [license-enforcement-service]", () => {
  const h = createService();
  try {
    const gate = h.service.getFeatureGate("sso");
    assert.ok(gate);
    assert.equal(gate!.enabled, true);

    h.service.disableFeatureGate("sso");
    const disabled = h.service.getFeatureGate("sso");
    assert.equal(disabled!.enabled, false);

    h.service.enableFeatureGate("sso");
    const reenabled = h.service.getFeatureGate("sso");
    assert.equal(reenabled!.enabled, true);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("custom feature gate can be registered [license-enforcement-service]", () => {
  const h = createService();
  try {
    h.service.registerFeatureGate({
      featureKey: "custom_feature",
      requiredTier: "enterprise",
      enabled: true,
      meterUsage: true,
      usageLimit: 100,
      usageWindowMs: 60 * 60 * 1000,
      warnThreshold: 0.8,
    });

    const gate = h.service.getFeatureGate("custom_feature");
    assert.ok(gate);
    assert.equal(gate!.requiredTier, "enterprise");

    const result = h.service.checkFeatureAccess("custom_feature", "enterprise");
    assert.equal(result.allowed, true);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("listFeatureGates returns all gates [license-enforcement-service]", () => {
  const h = createService();
  try {
    const gates = h.service.listFeatureGates();
    assert.ok(gates.length >= 10);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("listActiveMeters returns all meters [license-enforcement-service]", () => {
  const h = createService();
  try {
    h.service.recordFeatureUsage("audit_export");
    h.service.recordFeatureUsage("scim");

    const meters = h.service.listActiveMeters();
    assert.ok(meters.length >= 2);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("resetMeter clears meter [license-enforcement-service]", () => {
  const h = createService();
  try {
    h.service.recordFeatureUsage("audit_export");
    h.service.recordFeatureUsage("audit_export");

    let usage = h.service.getFeatureUsage("audit_export");
    assert.equal(usage!.count, 2);

    h.service.resetMeter("audit_export");
    usage = h.service.getFeatureUsage("audit_export");
    assert.equal(usage!.count, 0);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("strict mode denies instead of warns [license-enforcement-service]", () => {
  const h = createService();
  try {
    const strictService = new LicenseEnforcementService(h.store, { strictMode: true });
    const result = strictService.checkFeatureAccess("sso", "professional");
    assert.equal(result.allowed, false);
    assert.equal(result.action, "deny");
  } finally {
    cleanupPath(h.workspace);
  }
});
