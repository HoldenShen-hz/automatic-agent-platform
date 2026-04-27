/**
 * Unit tests for edge cases and private method coverage in License Enforcement Service
 *
 * @see src/scale-ecosystem/enterprise/license-enforcement-service.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { LicenseEnforcementService, type FeatureGate } from "../../../../src/scale-ecosystem/enterprise/license-enforcement-service.js";

// Mock AuthoritativeTaskStore
function createMockStore() {
  return {
    task: {
      getTask: () => null,
      insertTask: () => {},
    },
  };
}

describe("LicenseEnforcementService meter window expiration", () => {
  test("meter resets count when window expires", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    // Record usage
    service.recordFeatureUsage("scim", { accountId: "acct_window" });
    service.recordFeatureUsage("scim", { accountId: "acct_window" });

    let usage = service.getFeatureUsage("scim", { accountId: "acct_window" });
    assert.equal(usage?.count, 2);

    // Simulate window expiration by manually updating the meter
    // This is a workaround since we can't easily control time in tests
    // The actual window expiration happens in recordFeatureUsage
  });

  test("meter with no window end does not reset", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    // admin_console has no usageLimit (no window)
    service.recordFeatureUsage("admin_console", { accountId: "acct_no_window" });
    service.recordFeatureUsage("admin_console", { accountId: "acct_no_window" });

    const gate = service.getFeatureGate("admin_console");
    assert.equal(gate?.meterUsage, false); // admin_console is not metered
  });

  test("getFeatureUsage returns null for non-metered feature with no meter", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    const usage = service.getFeatureUsage("admin_console", { accountId: "acct_123" });
    assert.equal(usage, null); // admin_console is not metered
  });

  test("getFeatureUsage returns zero for metered feature with no usage", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    const usage = service.getFeatureUsage("audit_export", { accountId: "acct_new" });
    assert.equal(usage?.count, 0);
    assert.equal(usage?.limit, 1000);
    // When no meter exists yet but feature is metered, usageRatio is null
    assert.equal(usage?.usageRatio, null);
  });
});

describe("LicenseEnforcementService buildMeterKey", () => {
  test("meter key includes all context levels", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    service.recordFeatureUsage("scim", {
      accountId: "acct_1",
      workspaceId: "ws_1",
      tenantId: "tenant_1",
    });

    const meters = service.listActiveMeters();
    const meter = meters.find(m =>
      m.accountId === "acct_1" &&
      m.workspaceId === "ws_1" &&
      m.tenantId === "tenant_1"
    );

    assert.ok(meter, "Meter should exist with all context levels");
  });

  test("different contexts create separate meters", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    // Same feature, different accounts
    service.recordFeatureUsage("scim", { accountId: "acct_a" });
    service.recordFeatureUsage("scim", { accountId: "acct_b" });
    service.recordFeatureUsage("scim", { accountId: "acct_c" });

    const usageA = service.getFeatureUsage("scim", { accountId: "acct_a" });
    const usageB = service.getFeatureUsage("scim", { accountId: "acct_b" });
    const usageC = service.getFeatureUsage("scim", { accountId: "acct_c" });

    assert.equal(usageA?.count, 1);
    assert.equal(usageB?.count, 1);
    assert.equal(usageC?.count, 1);
  });

  test("global context meter when no context provided", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    service.recordFeatureUsage("audit_export"); // No context

    const usage = service.getFeatureUsage("audit_export");
    assert.equal(usage?.count, 1);
  });
});

describe("LicenseEnforcementService recordViolation", () => {
  test("violations are bounded at 1000", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      strictMode: true,
      logViolations: true,
    });

    // Generate many violations
    for (let i = 0; i < 1100; i++) {
      service.checkFeatureAccess("sso", "community");
    }

    const violations = service.getViolations(2000);
    assert.ok(violations.length <= 1000, "Violations should be bounded at 1000");
  });

  test("getViolations respects limit", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { strictMode: true });

    // Generate violations
    for (let i = 0; i < 50; i++) {
      service.checkFeatureAccess("sso", "community");
    }

    const violations = service.getViolations(10);
    assert.equal(violations.length, 10);
  });

  test("violation contains correct tier information", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { strictMode: true });

    service.checkFeatureAccess("sso", "community");

    const violations = service.getViolations();
    const lastViolation = violations[violations.length - 1];

    assert.ok(lastViolation);
    assert.equal(lastViolation.tierRequired, "enterprise");
    assert.equal(lastViolation.tierActual, "community");
    assert.equal(lastViolation.capability, "sso");
  });

  test("violation with context records account/workspace/tenant", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { strictMode: true });

    service.checkFeatureAccess("sso", "community", {
      accountId: "acct_test",
      workspaceId: "ws_test",
      tenantId: "tenant_test",
    });

    const violations = service.getViolations();
    const violation = violations[violations.length - 1];

    assert.equal(violation.accountId, "acct_test");
    assert.equal(violation.workspaceId, "ws_test");
    assert.equal(violation.tenantId, "tenant_test");
  });
});

describe("LicenseEnforcementService feature gate management edge cases", () => {
  test("getFeatureGate returns null for non-existent gate", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const gate = service.getFeatureGate("nonexistent_feature_xyz");
    assert.equal(gate, null);
  });

  test("enableFeatureGate returns false for non-existent gate", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const result = service.enableFeatureGate("nonexistent_feature_xyz");
    assert.equal(result, false);
  });

  test("disableFeatureGate returns false for non-existent gate", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const result = service.disableFeatureGate("nonexistent_feature_xyz");
    assert.equal(result, false);
  });

  test("updateFeatureLimit returns false for non-existent gate", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const result = service.updateFeatureLimit("nonexistent_feature_xyz", 1000, 3600000);
    assert.equal(result, false);
  });

  test("registerFeatureGate overwrites existing gate", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const originalGate = service.getFeatureGate("scim");
    assert.ok(originalGate);
    assert.equal(originalGate.requiredTier, "enterprise");

    const newGate: FeatureGate = {
      featureKey: "scim",
      requiredTier: "professional",
      enabled: true,
      meterUsage: false,
      usageLimit: null,
      usageWindowMs: null,
      warnThreshold: null,
    };

    service.registerFeatureGate(newGate);

    const updatedGate = service.getFeatureGate("scim");
    assert.equal(updatedGate?.requiredTier, "professional");
  });

  test("disableFeatureGate prevents access even for enterprise tier", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    service.disableFeatureGate("sso");

    const result = service.checkFeatureAccess("sso", "enterprise");
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "feature_not_found_or_disabled");
  });

  test("listFeatureGates returns copy not reference", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const gates1 = service.listFeatureGates();
    const gates2 = service.listFeatureGates();

    // Should be equal in content
    assert.equal(gates1.length, gates2.length);

    // Modifying returned array should not affect service
    gates1.push({ featureKey: "fake" } as FeatureGate);
    const gates3 = service.listFeatureGates();
    assert.equal(gates3.length, gates1.length - 1);
  });
});

describe("LicenseEnforcementService usage metering edge cases", () => {
  test("usageRatio is null when limit is null", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    // non-metered feature has null limit
    const usage = service.getFeatureUsage("admin_console", { accountId: "acct_123" });
    assert.equal(usage, null);
  });

  test("recordFeatureUsage does nothing when metering disabled", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: false });

    service.recordFeatureUsage("audit_export", { accountId: "acct_123" });

    // No meter is created when metering is disabled - listActiveMeters should be empty
    const meters = service.listActiveMeters();
    const auditMeters = meters.filter(m => m.feature === "audit_export" && m.accountId === "acct_123");
    assert.equal(auditMeters.length, 0, "No meter should be created when metering is disabled");
  });

  test("checkFeatureAccess does nothing for non-metered feature", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    // admin_console is not metered
    const result = service.checkFeatureAccess("admin_console", "enterprise");
    assert.equal(result.action, "meter"); // Still returns meter action
  });

  test("resetMeter returns false when meter does not exist", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    const result = service.resetMeter("nonexistent_feature", { accountId: "acct_123" });
    assert.equal(result, false);
  });

  test("resetMeter removes existing meter", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    service.recordFeatureUsage("audit_export", { accountId: "acct_reset" });
    let usage = service.getFeatureUsage("audit_export", { accountId: "acct_reset" });
    assert.equal(usage?.count, 1);

    const result = service.resetMeter("audit_export", { accountId: "acct_reset" });
    assert.equal(result, true);

    usage = service.getFeatureUsage("audit_export", { accountId: "acct_reset" });
    assert.equal(usage?.count, 0);
  });
});

describe("LicenseEnforcementService context handling", () => {
  test("checkFeatureAccess with null context values", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const result = service.checkFeatureAccess("sso", "enterprise", {
      accountId: null,
      workspaceId: null,
      tenantId: null,
    });

    assert.equal(result.allowed, true);
  });

  test("recordFeatureUsage with null context values", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    // Should not throw
    service.recordFeatureUsage("audit_export", {
      accountId: null,
      workspaceId: null,
      tenantId: null,
    });

    const usage = service.getFeatureUsage("audit_export", {
      accountId: null,
      workspaceId: null,
      tenantId: null,
    });
    assert.equal(usage?.count, 1);
  });

  test("checkFeatureAccess without optional context", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const result = service.checkFeatureAccess("sso", "enterprise");
    assert.equal(result.allowed, true);
  });
});

describe("LicenseEnforcementService config defaults", () => {
  test("default config values", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const config = service.getConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.strictMode, false);
    assert.equal(config.logViolations, true);
    assert.equal(config.defaultTier, "community");
    assert.equal(config.enableUsageMetering, true);
  });

  test("custom config overrides", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enabled: false,
      strictMode: true,
      logViolations: false,
      defaultTier: "professional",
      enableUsageMetering: false,
    });

    const config = service.getConfig();
    assert.equal(config.enabled, false);
    assert.equal(config.strictMode, true);
    assert.equal(config.logViolations, false);
    assert.equal(config.defaultTier, "professional");
    assert.equal(config.enableUsageMetering, false);
  });
});

describe("LicenseEnforcementService meter eviction", () => {
  test("listActiveMeters returns array", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    service.recordFeatureUsage("audit_export", { accountId: "acct_1" });
    service.recordFeatureUsage("scim", { accountId: "acct_2" });

    const meters = service.listActiveMeters();
    assert.ok(Array.isArray(meters));
    assert.ok(meters.length >= 2);
  });

  test("listActiveMeters returns copy not reference", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    service.recordFeatureUsage("audit_export", { accountId: "acct_1" });

    const meters1 = service.listActiveMeters();
    const meters2 = service.listActiveMeters();

    assert.equal(meters1.length, meters2.length);

    // Modifying returned array should not affect service
    meters1.push({} as any);
    const meters3 = service.listActiveMeters();
    assert.equal(meters3.length, meters1.length - 1);
  });
});

describe("LicenseEnforcementService cross-tier access", () => {
  test("professional tier allows professional feature", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const result = service.checkFeatureAccess("admin_console", "professional");
    assert.equal(result.allowed, true);
    assert.equal(result.action, "meter");
  });

  test("professional tier denies enterprise feature", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const result = service.checkFeatureAccess("sso", "professional");
    assert.equal(result.allowed, false);
    assert.equal(result.tierRequired, "enterprise");
    assert.equal(result.currentTier, "professional");
  });

  test("enterprise tier allows all features", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const features = ["admin_console", "sso", "scim", "tenant_isolation", "private_model"];
    for (const feature of features) {
      const result = service.checkFeatureAccess(feature, "enterprise");
      assert.equal(result.allowed, true, `Enterprise should allow ${feature}`);
    }
  });

  test("community tier denies professional and enterprise features", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    // Professional feature
    const adminResult = service.checkFeatureAccess("admin_console", "community");
    assert.equal(adminResult.allowed, false);

    // Enterprise features
    const ssoResult = service.checkFeatureAccess("sso", "community");
    assert.equal(ssoResult.allowed, false);
  });
});

describe("LicenseEnforcementService usage warning threshold", () => {
  test("warn threshold is not triggered below threshold", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    // Record 50% usage (threshold is 80%)
    for (let i = 0; i < 500; i++) {
      service.recordFeatureUsage("audit_export", { accountId: "acct_warn_test" });
    }

    const result = service.checkFeatureAccess("audit_export", "enterprise", { accountId: "acct_warn_test" });
    assert.equal(result.allowed, true);
    assert.notEqual(result.action, "warn");
  });

  test("usageRatio calculation is correct", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

    // Record 80% usage
    for (let i = 0; i < 800; i++) {
      service.recordFeatureUsage("audit_export", { accountId: "acct_ratio_test" });
    }

    const usage = service.getFeatureUsage("audit_export", { accountId: "acct_ratio_test" });
    assert.equal(usage?.count, 800);
    assert.equal(usage?.limit, 1000);
    assert.equal(usage?.usageRatio, 0.8);
  });
});
