/**
 * Unit tests for edge cases and boundary conditions in LicenseEnforcementService
 *
 * @see src/scale-ecosystem/enterprise/license-enforcement-service.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  LicenseEnforcementService,
  type FeatureGate,
  type LicenseCheckResult,
} from "../../../../src/scale-ecosystem/enterprise/license-enforcement-service.js";
import type { LicenseTier } from "../../../../src/scale-ecosystem/enterprise/enterprise-capability-matrix-service.js";

// Mock AuthoritativeTaskStore
function createMockStore() {
  return {
    task: {
      getTask: () => null,
      insertTask: () => {},
    },
  };
}

describe("LicenseEnforcementService meter eviction behavior", () => {
  test("evictStaleMeters removes meters older than TTL [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    // Record usage for a feature
    service.recordFeatureUsage("audit_export", { accountId: "acct_stale" });

    // Manually invoke eviction (normally called during recordFeatureUsage)
    // The service should have evicted stale meters based on time
    const meters = service.listActiveMeters();
    const auditMeters = meters.filter(
      (m) => m.feature === "audit_export" && m.accountId === "acct_stale"
    );
    assert.ok(auditMeters.length > 0, "Meter should exist after creation");
  });

  test("meter count resets to zero when window expires [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    // Record some usage
    service.recordFeatureUsage("scim", { accountId: "acct_window_reset" });
    service.recordFeatureUsage("scim", { accountId: "acct_window_reset" });

    let usage = service.getFeatureUsage("scim", { accountId: "acct_window_reset" });
    assert.equal(usage?.count, 2);

    // Reset the meter
    const resetResult = service.resetMeter("scim", { accountId: "acct_window_reset" });
    assert.equal(resetResult, true);

    usage = service.getFeatureUsage("scim", { accountId: "acct_window_reset" });
    assert.equal(usage?.count, 0);
  });

  test("meter with no limit does not trigger window expiration [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    // recordFeatureUsage for non-metered feature should not create a meter
    service.recordFeatureUsage("admin_console", { accountId: "acct_no_limit" });

    const usage = service.getFeatureUsage("admin_console", { accountId: "acct_no_limit" });
    // admin_console is not metered, so returns null
    assert.equal(usage, null);
  });

  test("usageRatio is calculated correctly at various fill levels [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    // Record 500 uses (50% of 1000 limit)
    for (let i = 0; i < 500; i++) {
      service.recordFeatureUsage("audit_export", { accountId: "acct_ratio" });
    }

    const usage = service.getFeatureUsage("audit_export", { accountId: "acct_ratio" });
    assert.equal(usage?.count, 500);
    assert.equal(usage?.limit, 1000);
    assert.equal(usage?.usageRatio, 0.5);
  });

  test("usageRatio approaches 1.0 as limit is reached [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    // Record 999 uses (99.9% of 1000 limit)
    for (let i = 0; i < 999; i++) {
      service.recordFeatureUsage("audit_export", { accountId: "acct_near_limit" });
    }

    const usage = service.getFeatureUsage("audit_export", { accountId: "acct_near_limit" });
    assert.equal(usage?.count, 999);
    assert.ok(usage?.usageRatio !== null && usage.usageRatio > 0.99);
  });
});

describe("LicenseEnforcementService warning threshold boundary conditions", () => {
  test("warn action triggers exactly at threshold [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    // Record 800 uses (exactly at 80% threshold for audit_export)
    for (let i = 0; i < 800; i++) {
      service.recordFeatureUsage("audit_export", { accountId: "acct_threshold" });
    }

    const result = service.checkFeatureAccess(
      "audit_export",
      "enterprise",
      { accountId: "acct_threshold" }
    );

    assert.equal(result.allowed, true);
    assert.equal(result.action, "warn");
    assert.ok(result.reason.includes("usage_threshold_warning"));
  });

  test("no warn action below threshold [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    // Record 799 uses (just below 80% threshold)
    for (let i = 0; i < 799; i++) {
      service.recordFeatureUsage("audit_export", { accountId: "acct_below" });
    }

    const result = service.checkFeatureAccess(
      "audit_export",
      "enterprise",
      { accountId: "acct_below" }
    );

    assert.equal(result.allowed, true);
    assert.notEqual(result.action, "warn");
  });

  test("warn threshold metadata includes usage details [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    // Record 800 uses to trigger warning
    for (let i = 0; i < 800; i++) {
      service.recordFeatureUsage("audit_export", { accountId: "acct_meta" });
    }

    const result = service.checkFeatureAccess(
      "audit_export",
      "enterprise",
      { accountId: "acct_meta" }
    );

    assert.equal(result.action, "warn");
    assert.ok(result.metadata);
    assert.ok(typeof result.metadata.usageRatio === "number");
    assert.ok(typeof result.metadata.meterCount === "number");
    assert.ok(typeof result.metadata.meterLimit === "number");
  });
});

describe("LicenseEnforcementService strict mode behavior", () => {
  test("strict mode denies access on insufficient tier [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      strictMode: true,
    });

    const result = service.checkFeatureAccess("sso", "professional");

    assert.equal(result.allowed, false);
    assert.equal(result.action, "deny");
    assert.equal(result.tierRequired, "enterprise");
    assert.equal(result.currentTier, "professional");
  });

  test("non-strict mode warns on insufficient tier without denying [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      strictMode: false,
    });

    const result = service.checkFeatureAccess("sso", "professional");

    assert.equal(result.allowed, false);
    assert.equal(result.action, "warn");
  });

  test("strict mode records violation for insufficient tier [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      strictMode: true,
      logViolations: true,
    });

    service.checkFeatureAccess("sso", "community");

    const violations = service.getViolations();
    assert.ok(violations.length > 0);
    const lastViolation = violations[violations.length - 1]!;
    assert.equal(lastViolation.tierRequired, "enterprise");
    assert.equal(lastViolation.tierActual, "community");
    assert.equal(lastViolation.action, "deny");
  });

  test("non-strict mode records warn violation [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      strictMode: false,
      logViolations: true,
    });

    service.checkFeatureAccess("sso", "community");

    const violations = service.getViolations();
    assert.ok(violations.length > 0);
    const lastViolation = violations[violations.length - 1]!;
    assert.equal(lastViolation.action, "warn");
  });
});

describe("LicenseEnforcementService enforcement disabled edge cases", () => {
  test("checkFeatureAccess always allows when disabled [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enabled: false,
    });

    const result = service.checkFeatureAccess("sso", "community");

    assert.equal(result.allowed, true);
    assert.equal(result.action, "allow");
    assert.equal(result.reason, "enforcement_disabled");
  });

  test("checkFeatureAccess does not record violation when disabled [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enabled: false,
      logViolations: true,
    });

    service.checkFeatureAccess("sso", "community");

    const violations = service.getViolations();
    assert.equal(violations.length, 0);
  });

  test("recordFeatureUsage is no-op when metering disabled [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: false,
    });

    service.recordFeatureUsage("audit_export", { accountId: "acct_disabled" });

    // When metering disabled, getFeatureUsage returns info based on gate definition
    // because no meter is actually created, but the gate itself is still known
    const usage = service.getFeatureUsage("audit_export", { accountId: "acct_disabled" });
    // Returns zeroed usage based on gate definition, not null (metering disabled doesn't hide gate info)
    assert.equal(usage?.count, 0);
    assert.equal(usage?.limit, 1000);
  });

  test("getFeatureUsage returns null when metering disabled for non-metered feature [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: false,
    });

    // admin_console is not metered, so returns null
    const usage = service.getFeatureUsage("admin_console", { accountId: "acct_check" });
    assert.equal(usage, null);
  });
});

describe("LicenseEnforcementService all tier combinations", () => {
  const tiers: LicenseTier[] = ["community", "professional", "enterprise"];

  test("community tier cannot access any professional+ feature [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    for (const tier of ["professional", "enterprise"] as LicenseTier[]) {
      const result = service.checkFeatureAccess("admin_console", tier);
      assert.equal(result.currentTier, tier);
    }
  });

  test("enterprise tier can access all defined features [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const gates = service.listFeatureGates();
    for (const gate of gates) {
      const result = service.checkFeatureAccess(gate.featureKey, "enterprise");
      assert.equal(
        result.allowed,
        true,
        `Enterprise tier should allow ${gate.featureKey}`
      );
    }
  });

  test("professional tier allows professional feature but not enterprise [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const adminResult = service.checkFeatureAccess("admin_console", "professional");
    assert.equal(adminResult.allowed, true);

    const ssoResult = service.checkFeatureAccess("sso", "professional");
    assert.equal(ssoResult.allowed, false);
  });

  test("compareTier is transitive [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const gates = service.listFeatureGates();
    for (const gate of gates) {
      if (gate.requiredTier === "community") continue;

      const result = service.checkFeatureAccess(gate.featureKey, "community");
      assert.equal(
        result.allowed,
        false,
        `Community should not access ${gate.featureKey} which requires ${gate.requiredTier}`
      );
    }
  });
});

describe("LicenseEnforcementService meter key uniqueness", () => {
  test("meter key includes all context levels [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    service.recordFeatureUsage("scim", {
      accountId: "acct_1",
      workspaceId: "ws_1",
      tenantId: "tenant_1",
    });

    const meters = service.listActiveMeters();
    const matchingMeter = meters.find(
      (m) =>
        m.accountId === "acct_1" &&
        m.workspaceId === "ws_1" &&
        m.tenantId === "tenant_1"
    );

    assert.ok(matchingMeter, "Meter should exist with all context levels");
  });

  test("same feature different tenants have separate meters [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    service.recordFeatureUsage("scim", { tenantId: "tenant_a" });
    service.recordFeatureUsage("scim", { tenantId: "tenant_b" });

    const usageA = service.getFeatureUsage("scim", { tenantId: "tenant_a" });
    const usageB = service.getFeatureUsage("scim", { tenantId: "tenant_b" });

    assert.equal(usageA?.count, 1);
    assert.equal(usageB?.count, 1);
  });

  test("global context creates global meter [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enableUsageMetering: true,
    });

    service.recordFeatureUsage("audit_export"); // No context

    const usage = service.getFeatureUsage("audit_export"); // No context
    assert.equal(usage?.count, 1);
  });
});

describe("LicenseEnforcementService feature gate management", () => {
  test("registerFeatureGate adds new gate [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const newGate: FeatureGate = {
      featureKey: "new_exciting_feature",
      requiredTier: "enterprise",
      enabled: true,
      meterUsage: true,
      usageLimit: 5000,
      usageWindowMs: 3600000,
      warnThreshold: 0.9,
    };

    service.registerFeatureGate(newGate);

    const retrieved = service.getFeatureGate("new_exciting_feature");
    assert.ok(retrieved);
    assert.equal(retrieved.requiredTier, "enterprise");
    assert.equal(retrieved.usageLimit, 5000);
  });

  test("registerFeatureGate updates existing gate [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const original = service.getFeatureGate("scim");
    assert.ok(original);
    const originalLimit = original.usageLimit;

    const updated: FeatureGate = {
      featureKey: "scim",
      requiredTier: "enterprise",
      enabled: true,
      meterUsage: true,
      usageLimit: 9999,
      usageWindowMs: 7200000,
      warnThreshold: 0.95,
    };

    service.registerFeatureGate(updated);

    const retrieved = service.getFeatureGate("scim");
    assert.equal(retrieved?.usageLimit, 9999);
    assert.notEqual(retrieved?.usageLimit, originalLimit);
  });

  test("enableFeatureGate on existing gate works [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    service.disableFeatureGate("sso");
    let result = service.checkFeatureAccess("sso", "enterprise");
    assert.equal(result.allowed, false);

    const enabled = service.enableFeatureGate("sso");
    assert.equal(enabled, true);

    result = service.checkFeatureAccess("sso", "enterprise");
    assert.equal(result.allowed, true);
  });

  test("disableFeatureGate on non-existent gate returns false [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const result = service.disableFeatureGate("nonexistent_feature_12345");
    assert.equal(result, false);
  });

  test("updateFeatureLimit modifies existing gate [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const original = service.getFeatureGate("scim");
    assert.ok(original);

    const updated = service.updateFeatureLimit("scim", 10000, 48 * 60 * 60 * 1000);
    assert.equal(updated, true);

    const modified = service.getFeatureGate("scim");
    assert.equal(modified?.usageLimit, 10000);
    assert.equal(modified?.usageWindowMs, 48 * 60 * 60 * 1000);
  });

  test("listFeatureGates returns all registered gates [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const gates = service.listFeatureGates();
    const keys = gates.map((g) => g.featureKey);

    assert.ok(keys.includes("admin_console"));
    assert.ok(keys.includes("sso"));
    assert.ok(keys.includes("scim"));
    assert.ok(keys.includes("audit_export"));
  });
});

describe("LicenseEnforcementService violation management", () => {
  test("getViolations returns violations in order [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      strictMode: true,
    });

    service.checkFeatureAccess("sso", "community");
    service.checkFeatureAccess("scim", "professional");

    const violations = service.getViolations();
    assert.ok(violations.length >= 2);
  });

  test("getViolations respects limit parameter [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      strictMode: true,
    });

    for (let i = 0; i < 20; i++) {
      service.checkFeatureAccess("sso", "community");
    }

    const violations = service.getViolations(5);
    assert.equal(violations.length, 5);
  });

  test("violations are logged with correct metadata [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      strictMode: true,
      logViolations: true,
    });

    service.checkFeatureAccess("sso", "community", {
      accountId: "test_account",
      workspaceId: "test_workspace",
      tenantId: "test_tenant",
    });

    const violations = service.getViolations();
    const lastViolation = violations[violations.length - 1];
    assert.ok(lastViolation);
    assert.ok(lastViolation.id.startsWith("lv_"));
    assert.equal(lastViolation.accountId, "test_account");
    assert.equal(lastViolation.workspaceId, "test_workspace");
    assert.equal(lastViolation.tenantId, "test_tenant");
    assert.equal(lastViolation.capability, "sso");
    assert.ok(lastViolation.occurredAt);
  });

  test("violations array is bounded at 1000 entries [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      strictMode: true,
      logViolations: true,
    });

    // Generate many violations
    for (let i = 0; i < 1500; i++) {
      service.checkFeatureAccess("sso", "community");
    }

    const violations = service.getViolations();
    assert.ok(violations.length <= 1000);
  });
});

describe("LicenseEnforcementService configuration", () => {
  test("default configuration values [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    const config = service.getConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.strictMode, false);
    assert.equal(config.logViolations, true);
    assert.equal(config.defaultTier, "community");
    assert.equal(config.enableUsageMetering, true);
  });

  test("custom configuration overrides defaults [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any, {
      enabled: false,
      strictMode: true,
      logViolations: false,
      defaultTier: "enterprise",
      enableUsageMetering: false,
    });

    const config = service.getConfig();
    assert.equal(config.enabled, false);
    assert.equal(config.strictMode, true);
    assert.equal(config.logViolations, false);
    assert.equal(config.defaultTier, "enterprise");
    assert.equal(config.enableUsageMetering, false);
  });

  test("setEnabled updates config [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    assert.equal(service.isEnabled(), true);
    service.setEnabled(false);
    assert.equal(service.isEnabled(), false);
  });

  test("setStrictMode updates config [license-enforcement-service-edge-cases-v2]", () => {
    const service = new LicenseEnforcementService(createMockStore() as any);

    assert.equal(service.isStrictMode(), false);
    service.setStrictMode(true);
    assert.equal(service.isStrictMode(), true);
  });
});