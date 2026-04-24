import assert from "node:assert/strict";
import test from "node:test";

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

test("LicenseEnforcementService allows access when enforcement disabled", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { enabled: false });

  const result = service.checkFeatureAccess("sso", "community");

  assert.equal(result.allowed, true);
  assert.equal(result.action, "allow");
  assert.equal(result.reason, "enforcement_disabled");
});

test("LicenseEnforcementService denies feature not in gates", () => {
  const service = new LicenseEnforcementService(createMockStore() as any);

  const result = service.checkFeatureAccess("nonexistent_feature", "enterprise");

  assert.equal(result.allowed, false);
  assert.equal(result.action, "deny");
  assert.equal(result.reason, "feature_not_found_or_disabled");
});

test("LicenseEnforcementService denies enterprise feature for community tier in strict mode", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { strictMode: true });

  const result = service.checkFeatureAccess("sso", "community");

  assert.equal(result.allowed, false);
  assert.equal(result.action, "deny");
  assert.equal(result.tierRequired, "enterprise");
  assert.equal(result.currentTier, "community");
});

test("LicenseEnforcementService warns community tier for enterprise feature in non-strict mode", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { strictMode: false });

  const result = service.checkFeatureAccess("sso", "community");

  assert.equal(result.allowed, false);
  assert.equal(result.action, "warn");
});

test("LicenseEnforcementService allows enterprise feature for enterprise tier", () => {
  const service = new LicenseEnforcementService(createMockStore() as any);

  const result = service.checkFeatureAccess("sso", "enterprise");

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "access_granted");
});

test("LicenseEnforcementService allows professional feature for enterprise tier", () => {
  const service = new LicenseEnforcementService(createMockStore() as any);

  const result = service.checkFeatureAccess("admin_console", "enterprise");

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "access_granted");
});

test("LicenseEnforcementService tracks violations", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { strictMode: true });

  service.checkFeatureAccess("sso", "community");

  const violations = service.getViolations();
  assert.ok(violations.length > 0);
  assert.equal(violations[violations.length - 1].capability, "sso");
  assert.equal(violations[violations.length - 1].tierActual, "community");
  assert.equal(violations[violations.length - 1].tierRequired, "enterprise");
});

test("LicenseEnforcementService does not log violations when disabled", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { logViolations: false });

  service.checkFeatureAccess("sso", "community");

  const violations = service.getViolations();
  assert.equal(violations.length, 0);
});

test("LicenseEnforcementService meters usage correctly", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

  service.recordFeatureUsage("audit_export", { accountId: "acct_123" });
  service.recordFeatureUsage("audit_export", { accountId: "acct_123" });
  service.recordFeatureUsage("audit_export", { accountId: "acct_123" });

  const usage = service.getFeatureUsage("audit_export", { accountId: "acct_123" });
  assert.equal(usage?.count, 3);
  assert.equal(usage?.limit, 1000);
});

test("LicenseEnforcementService denies when usage limit exceeded", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

  // Record 1000 uses (at limit)
  for (let i = 0; i < 1000; i++) {
    service.recordFeatureUsage("audit_export", { accountId: "acct_limit_test" });
  }

  const result = service.checkFeatureAccess("audit_export", "enterprise", { accountId: "acct_limit_test" });

  assert.equal(result.allowed, false);
  assert.equal(result.action, "deny");
  assert.ok(result.reason.includes("usage_limit_exceeded"));
});

test("LicenseEnforcementService warns when approaching usage threshold", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

  // Record 800 uses (80% of 1000 limit = warn threshold)
  for (let i = 0; i < 800; i++) {
    service.recordFeatureUsage("audit_export", { accountId: "acct_warn_test" });
  }

  const result = service.checkFeatureAccess("audit_export", "enterprise", { accountId: "acct_warn_test" });

  assert.equal(result.allowed, true);
  assert.equal(result.action, "warn");
  assert.ok(result.reason.includes("usage_threshold_warning"));
});

test("LicenseEnforcementService registers custom feature gate", () => {
  const service = new LicenseEnforcementService(createMockStore() as any);

  const gate: FeatureGate = {
    featureKey: "custom_feature",
    requiredTier: "professional",
    enabled: true,
    meterUsage: false,
    usageLimit: null,
    usageWindowMs: null,
    warnThreshold: null,
  };

  service.registerFeatureGate(gate);

  const result = service.checkFeatureAccess("custom_feature", "community");

  assert.equal(result.allowed, false);
  assert.equal(result.tierRequired, "professional");
});

test("LicenseEnforcementService enables and disables feature gates", () => {
  const service = new LicenseEnforcementService(createMockStore() as any);

  service.disableFeatureGate("sso");
  const result1 = service.checkFeatureAccess("sso", "enterprise");
  assert.equal(result1.allowed, false);
  assert.equal(result1.reason, "feature_not_found_or_disabled");

  service.enableFeatureGate("sso");
  const result2 = service.checkFeatureAccess("sso", "enterprise");
  assert.equal(result2.allowed, true);
});

test("LicenseEnforcementService resets meter correctly", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

  service.recordFeatureUsage("scim", { accountId: "acct_reset" });
  service.recordFeatureUsage("scim", { accountId: "acct_reset" });

  const usageBefore = service.getFeatureUsage("scim", { accountId: "acct_reset" });
  assert.equal(usageBefore?.count, 2);

  service.resetMeter("scim", { accountId: "acct_reset" });

  const usageAfter = service.getFeatureUsage("scim", { accountId: "acct_reset" });
  assert.equal(usageAfter?.count, 0);
});

test("LicenseEnforcementService lists active meters", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

  service.recordFeatureUsage("audit_export", { accountId: "acct_1" });
  service.recordFeatureUsage("scim", { accountId: "acct_2" });

  const meters = service.listActiveMeters();
  assert.ok(meters.length >= 2);
});

test("LicenseEnforcementService updateFeatureLimit works", () => {
  const service = new LicenseEnforcementService(createMockStore() as any);

  const updated = service.updateFeatureLimit("audit_export", 5000, 60 * 60 * 1000);

  assert.equal(updated, true);
  const gate = service.getFeatureGate("audit_export");
  assert.equal(gate?.usageLimit, 5000);
  assert.equal(gate?.usageWindowMs, 60 * 60 * 1000);
});

test("LicenseEnforcementService getConfig returns config", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, {
    enabled: true,
    strictMode: true,
    logViolations: false,
    defaultTier: "professional",
    enableUsageMetering: false,
  });

  const config = service.getConfig();
  assert.equal(config.enabled, true);
  assert.equal(config.strictMode, true);
  assert.equal(config.logViolations, false);
  assert.equal(config.defaultTier, "professional");
  assert.equal(config.enableUsageMetering, false);
});

test("LicenseEnforcementService isEnabled and setEnabled work", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { enabled: true });

  assert.equal(service.isEnabled(), true);

  service.setEnabled(false);
  assert.equal(service.isEnabled(), false);

  service.setEnabled(true);
  assert.equal(service.isEnabled(), true);
});

test("LicenseEnforcementService isStrictMode and setStrictMode work", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { strictMode: false });

  assert.equal(service.isStrictMode(), false);

  service.setStrictMode(true);
  assert.equal(service.isStrictMode(), true);
});

test("LicenseEnforcementService different contexts have separate meters", () => {
  const service = new LicenseEnforcementService(createMockStore() as any, { enableUsageMetering: true });

  service.recordFeatureUsage("scim", { accountId: "acct_a", workspaceId: "ws_a" });
  service.recordFeatureUsage("scim", { accountId: "acct_b", workspaceId: "ws_b" });

  const usageA = service.getFeatureUsage("scim", { accountId: "acct_a", workspaceId: "ws_a" });
  const usageB = service.getFeatureUsage("scim", { accountId: "acct_b", workspaceId: "ws_b" });

  assert.equal(usageA?.count, 1);
  assert.equal(usageB?.count, 1);
});

test("LicenseEnforcementService listFeatureGates returns all gates", () => {
  const service = new LicenseEnforcementService(createMockStore() as any);

  const gates = service.listFeatureGates();

  assert.ok(gates.length > 0);
  assert.ok(gates.some(g => g.featureKey === "sso"));
  assert.ok(gates.some(g => g.featureKey === "scim"));
  assert.ok(gates.some(g => g.featureKey === "admin_console"));
});
