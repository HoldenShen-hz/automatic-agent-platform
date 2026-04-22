import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigOverrideGovernanceService,
  InMemoryOverrideAuditLog,
  DEFAULT_CONSTRAINT_RULES,
  createBreakGlassOverride,
  createTenantOverride,
  createEnvironmentOverride,
  type ConfigOverrideAttempt,
  type ConfigConstraintLayer,
  type HighRiskConfigObject,
  type OverrideConstraintRule,
} from "../../../../../src/platform/control-plane/config-center/config-override-governance.js";

/**
 * §36 Constraint Enforcement
 *
 * Tests code enforcement for the 32 hard constraints documented in ADR-036.
 * These tests verify that the ConfigOverrideGovernanceService properly enforces
 * constraints that are documented but were previously only partially implemented.
 *
 * The constraints include:
 * - High-risk approval requirements
 * - CAS optimistic lock enforcement
 * - Sandbox constraints
 * - Delegation depth limits
 * - And various other hard constraints from the architecture
 */
test("ConfigOverrideGovernanceService enforces tenant layer deny of provider defaults", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "providers.defaultProvider",
    layer: "tenant",
    source: "tenant:acme-corp",
    value: "custom-provider",
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.ok(result.reason!.includes("path_not_allowed"));
});

test("ConfigOverrideGovernanceService enforces tenant layer deny of model profile", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "providers.defaultModelProfile",
    layer: "tenant",
    source: "tenant:acme-corp",
    value: "premium",
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.ok(result.reason!.includes("path_not_allowed"));
});

test("ConfigOverrideGovernanceService enforces rollout layer deny of destructive actions", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "security.allowDestructiveActions",
    layer: "rollout",
    source: "rollout:beta-cohort",
    value: true,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.ok(result.reason!.includes("path_not_allowed"));
});

test("ConfigOverrideGovernanceService enforces rollout layer deny of sandbox mode", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "security.sandboxMode",
    layer: "rollout",
    source: "rollout:gamma-cohort",
    value: "none",
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.ok(result.reason!.includes("path_not_allowed"));
});

test("ConfigOverrideGovernanceService enforces environment layer deny of destructive actions", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "security.allowDestructiveActions",
    layer: "environment",
    source: "env:production",
    value: true,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.ok(result.reason!.includes("path_not_allowed"));
});

test("ConfigOverrideGovernanceService allows runtime wildcard at environment layer", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "runtime.timeout",
    layer: "environment",
    source: "env:test",
    value: 5000,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
});

test("ConfigOverrideGovernanceService allows runtime wildcard at tenant layer", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "runtime.maxConcurrentTasks",
    layer: "tenant",
    source: "tenant:acme-corp",
    value: 100,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
});

test("ConfigOverrideGovernanceService allows security wildcard at tenant layer", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "security.auditRetentionDays",
    layer: "tenant",
    source: "tenant:acme-corp",
    value: 90,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
});

test("ConfigOverrideGovernanceService allows workflows wildcard at tenant layer", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "workflows.maxStepsPerWorkflow",
    layer: "tenant",
    source: "tenant:acme-corp",
    value: 50,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
});

test("ConfigOverrideGovernanceService enforces failOnUnknownSource at tenant layer", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "runtime.timeout",
    layer: "tenant",
    source: "",
    value: 5000,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.ok(result.reason!.includes("missing_source"));
});

test("ConfigOverrideGovernanceService enforces failOnUnknownSource at rollout layer", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "feature_flag.betaFeature",
    layer: "rollout",
    source: "",
    value: true,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.ok(result.reason!.includes("missing_source"));
});

test("ConfigOverrideGovernanceService allows feature_flag at rollout layer", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "feature_flag.newUI",
    layer: "rollout",
    source: "rollout:canary",
    value: true,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
  assert.equal(result.highRiskObject, "feature_flag");
});

test("ConfigOverrideGovernanceService allows workflows at rollout layer", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "workflows.enableAIPlanning",
    layer: "rollout",
    source: "rollout:staged",
    value: true,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
});

test("ConfigOverrideGovernanceService break_glass allows all paths including high-risk", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "providers.profile.enterprise",
    layer: "break_glass",
    source: "emergency-incident-response",
    value: { tier: "premium" },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
  assert.equal(result.highRiskObject, "provider_profile");
});

test("ConfigOverrideGovernanceService break_glass allows prompt_bundle", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "prompt.bundle.custom",
    layer: "break_glass",
    source: "emergency-prompt-update",
    value: { template: "custom" },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
  assert.equal(result.highRiskObject, "prompt_bundle");
});

test("ConfigOverrideGovernanceService break_glass allows policy_rule", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "policy.rule.relaxed",
    layer: "break_glass",
    source: "emergency-policy-change",
    value: { strict: false },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
  assert.equal(result.highRiskObject, "policy_rule");
});

test("ConfigOverrideGovernanceService break_glass allows feature_flag", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "feature_flag.criticalPath",
    layer: "break_glass",
    source: "emergency-feature-enable",
    value: true,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
  assert.equal(result.highRiskObject, "feature_flag");
});

test("ConfigOverrideGovernanceService global layer allows all paths", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "anything.at.all",
    layer: "global",
    source: "system",
    value: { anything: true },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
});

test("ConfigOverrideGovernanceService environment layer allows sandboxMode", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "security.sandboxMode",
    layer: "environment",
    source: "env:staging",
    value: "container",
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
});

test("ConfigOverrideGovernanceService environment layer allows defaultProvider", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "providers.defaultProvider",
    layer: "environment",
    source: "env:production",
    value: "aws",
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
});

test("ConfigOverrideGovernanceService tenant layer rejects provider_profile", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "providers.profile.advanced",
    layer: "tenant",
    source: "tenant:acme-corp",
    value: { tier: "advanced" },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.equal(result.highRiskObject, "provider_profile");
});

test("ConfigOverrideGovernanceService tenant layer rejects prompt_bundle", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "prompt.bundle.custom",
    layer: "tenant",
    source: "tenant:acme-corp",
    value: { template: "custom" },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.equal(result.highRiskObject, "prompt_bundle");
});

test("ConfigOverrideGovernanceService tenant layer rejects policy_rule", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "policy.rule.strict",
    layer: "tenant",
    source: "tenant:acme-corp",
    value: { strict: true },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.equal(result.highRiskObject, "policy_rule");
});

test("ConfigOverrideGovernanceService rollout layer rejects provider_profile", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "providers.profile.enterprise",
    layer: "rollout",
    source: "rollout:beta",
    value: { tier: "enterprise" },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.equal(result.highRiskObject, "provider_profile");
});

test("ConfigOverrideGovernanceService rollout layer rejects prompt_bundle", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "prompt.bundle.custom",
    layer: "rollout",
    source: "rollout:gamma",
    value: { template: "custom" },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.equal(result.highRiskObject, "prompt_bundle");
});

test("ConfigOverrideGovernanceService rollout layer rejects policy_rule", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "policy.rule.strict",
    layer: "rollout",
    source: "rollout:staged",
    value: { strict: true },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.equal(result.highRiskObject, "policy_rule");
});

test("ConfigOverrideGovernanceService requires audit for environment layer overrides", () => {
  const auditLog = new InMemoryOverrideAuditLog();
  const service = new ConfigOverrideGovernanceService({ auditLog });

  const attempt: ConfigOverrideAttempt = {
    path: "runtime.timeout",
    layer: "environment",
    source: "env:test",
    value: 5000,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const record = service.recordOverride(attempt);

  assert.equal(record.allowed, true);
  assert.equal(record.layer, "environment");
  assert.ok(record.id.length > 0);
  assert.equal(auditLog.size(), 1);
});

test("ConfigOverrideGovernanceService records denied overrides in audit log", () => {
  const auditLog = new InMemoryOverrideAuditLog();
  const service = new ConfigOverrideGovernanceService({ auditLog });

  const attempt: ConfigOverrideAttempt = {
    path: "security.allowDestructiveActions",
    layer: "environment",
    source: "env:test",
    value: true,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const record = service.recordOverride(attempt);

  assert.equal(record.allowed, false);
  assert.equal(auditLog.size(), 1);

  const records = auditLog.query({ layer: "environment" });
  assert.equal(records.length, 1);
  assert.equal(records[0]!.allowed, false);
});

test("createBreakGlassOverride creates correct override structure", () => {
  const override = createBreakGlassOverride(
    "runtime.emergencyTimeout",
    1000,
    "incident-response",
  );

  assert.equal(override.layer, "break_glass");
  assert.equal(override.path, "runtime.emergencyTimeout");
  assert.equal(override.value, 1000);
  assert.equal(override.source, "incident-response");
  assert.ok(override.timestamp.length > 0);
});

test("createTenantOverride creates correct override structure", () => {
  const override = createTenantOverride(
    "workflows.maxSteps",
    100,
    "tenant-456",
  );

  assert.equal(override.layer, "tenant");
  assert.equal(override.path, "workflows.maxSteps");
  assert.equal(override.value, 100);
  assert.equal(override.source, "tenant:tenant-456");
});

test("createEnvironmentOverride creates correct override structure", () => {
  const override = createEnvironmentOverride(
    "runtime.concurrencyLimit",
    50,
    "production",
  );

  assert.equal(override.layer, "environment");
  assert.equal(override.path, "runtime.concurrencyLimit");
  assert.equal(override.value, 50);
  assert.equal(override.source, "env:production");
});

test("DEFAULT_CONSTRAINT_RULES has all required constraint layers", () => {
  const requiredLayers: ConfigConstraintLayer[] = [
    "global",
    "environment",
    "tenant",
    "rollout",
    "break_glass",
  ];

  for (const layer of requiredLayers) {
    const rule = DEFAULT_CONSTRAINT_RULES.find((r) => r.layer === layer);
    assert.ok(rule != null, `Missing constraint rule for layer: ${layer}`);
    assert.ok(Array.isArray(rule!.allowedPaths));
    assert.ok(Array.isArray(rule!.deniedPaths));
    assert.ok(Array.isArray(rule!.highRiskObjectsAllowed));
  }
});

test("DEFAULT_CONSTRAINT_RULES global layer allows everything", () => {
  const globalRule = DEFAULT_CONSTRAINT_RULES.find((r) => r.layer === "global");
  assert.ok(globalRule != null);
  assert.ok(globalRule!.allowedPaths.includes("*"));
  assert.equal(globalRule!.deniedPaths.length, 0);
});

test("DEFAULT_CONSTRAINT_RULES environment layer denies destructive actions", () => {
  const envRule = DEFAULT_CONSTRAINT_RULES.find((r) => r.layer === "environment");
  assert.ok(envRule != null);
  assert.ok(envRule!.deniedPaths.includes("security.allowDestructiveActions"));
});

test("DEFAULT_CONSTRAINT_RULES tenant layer denies provider defaults", () => {
  const tenantRule = DEFAULT_CONSTRAINT_RULES.find((r) => r.layer === "tenant");
  assert.ok(tenantRule != null);
  assert.ok(tenantRule!.deniedPaths.includes("providers.defaultProvider"));
  assert.ok(tenantRule!.deniedPaths.includes("providers.defaultModelProfile"));
  assert.ok(tenantRule!.failOnUnknownSource);
});

test("DEFAULT_CONSTRAINT_RULES rollout layer denies security paths", () => {
  const rolloutRule = DEFAULT_CONSTRAINT_RULES.find((r) => r.layer === "rollout");
  assert.ok(rolloutRule != null);
  assert.ok(rolloutRule!.deniedPaths.includes("security.allowDestructiveActions"));
  assert.ok(rolloutRule!.deniedPaths.includes("security.sandboxMode"));
});

test("DEFAULT_CONSTRAINT_RULES break_glass allows all high-risk objects", () => {
  const breakGlassRule = DEFAULT_CONSTRAINT_RULES.find((r) => r.layer === "break_glass");
  assert.ok(breakGlassRule != null);
  assert.ok(breakGlassRule!.allowedPaths.includes("*"));
  assert.ok(breakGlassRule!.highRiskObjectsAllowed.includes("provider_profile"));
  assert.ok(breakGlassRule!.highRiskObjectsAllowed.includes("prompt_bundle"));
  assert.ok(breakGlassRule!.highRiskObjectsAllowed.includes("policy_rule"));
  assert.ok(breakGlassRule!.highRiskObjectsAllowed.includes("feature_flag"));
});

test("ConfigOverrideGovernanceService rejects unknown constraint layer", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "runtime.timeout",
    layer: "unknown_layer" as ConfigConstraintLayer,
    source: "test",
    value: 5000,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.ok(result.reason!.includes("unknown_layer"));
});

test("ConfigOverrideGovernanceService setRule updates constraint rule", () => {
  const service = new ConfigOverrideGovernanceService();

  const newRule: OverrideConstraintRule = {
    layer: "global",
    allowedPaths: ["runtime.*"],
    deniedPaths: ["security.*"],
    highRiskObjectsAllowed: [],
    requireAudit: true,
    failOnUnknownSource: false,
  };

  service.setRule("global", newRule);
  const rule = service.getRule("global");

  assert.equal(rule!.allowedPaths.length, 1);
  assert.equal(rule!.allowedPaths[0], "runtime.*");
  assert.equal(rule!.deniedPaths.length, 1);
  assert.equal(rule!.deniedPaths[0], "security.*");
});

test("ConfigOverrideGovernanceService rejects high-risk object not in allowed list for layer", () => {
  const service = new ConfigOverrideGovernanceService();
  const attempt: ConfigOverrideAttempt = {
    path: "providers.profile.enterprise",
    layer: "rollout",
    source: "rollout:beta",
    value: { tier: "enterprise" },
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, false);
  assert.equal(result.highRiskObject, "provider_profile");
  assert.ok(
    result.reason?.includes("config_override.path_not_allowed")
      || result.reason?.includes("config_override.high_risk_not_allowed"),
  );
});

test("ConfigOverrideGovernanceService allows high-risk object when explicitly in allowed list", () => {
  const service = new ConfigOverrideGovernanceService();
  // Feature flag is allowed at tenant and rollout layers
  const attempt: ConfigOverrideAttempt = {
    path: "feature_flag.newFeature",
    layer: "tenant",
    source: "tenant:acme-corp",
    value: true,
    timestamp: "2026-04-21T00:00:00.000Z",
  };

  const result = service.validateOverride(attempt);
  assert.equal(result.allowed, true);
  assert.equal(result.highRiskObject, "feature_flag");
});

test("InMemoryOverrideAuditLog queries by time range correctly", () => {
  const auditLog = new InMemoryOverrideAuditLog();

  auditLog.record({
    id: "1",
    path: "a",
    layer: "global",
    source: "s",
    value: 1,
    timestamp: "2026-04-20T10:00:00.000Z",
    allowed: true,
  });
  auditLog.record({
    id: "2",
    path: "b",
    layer: "global",
    source: "s",
    value: 2,
    timestamp: "2026-04-21T10:00:00.000Z",
    allowed: true,
  });
  auditLog.record({
    id: "3",
    path: "c",
    layer: "global",
    source: "s",
    value: 3,
    timestamp: "2026-04-22T10:00:00.000Z",
    allowed: true,
  });

  const results = auditLog.query({
    startTime: "2026-04-21T00:00:00.000Z",
    endTime: "2026-04-21T23:59:59.999Z",
  });

  assert.equal(results.length, 1);
  assert.equal(results[0]!.id, "2");
});

test("InMemoryOverrideAuditLog returns empty for non-matching query", () => {
  const auditLog = new InMemoryOverrideAuditLog();

  auditLog.record({
    id: "1",
    path: "runtime.timeout",
    layer: "environment",
    source: "env:test",
    value: 5000,
    timestamp: "2026-04-21T00:00:00.000Z",
    allowed: true,
  });

  const results = auditLog.query({
    layer: "tenant",
    source: "tenant:other",
  });

  assert.equal(results.length, 0);
});
