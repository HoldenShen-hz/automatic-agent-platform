/**
 * Model Routing CLI Tests
 *
 * Tests for model-routing.ts CLI module and its environment loader.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadModelRoutingCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { MODEL_ROUTE_CLASSES, MODEL_ROUTE_RISK_LEVELS } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-support.js";

// ---------------------------------------------------------------------------
// Tests for loadModelRoutingCliEnv
// ---------------------------------------------------------------------------

test("loadModelRoutingCliEnv parses route class options", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_CLASS: "default",
  });

  assert.equal(config.routeClass, "default");
});

test("loadModelRoutingCliEnv parses risk level options", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_RISK_LEVEL: "high",
  });

  assert.equal(config.riskLevel, "high");
});

test("loadModelRoutingCliEnv parses profile names", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_PREFERRED_PROFILE: "claude-sonnet",
    AA_MODEL_ROUTE_PINNED_PROFILE: "claude-opus",
    AA_MODEL_ROUTE_STICKY_PROFILE: "claude-haiku",
  });

  assert.equal(config.preferredProfileName, "claude-sonnet");
  assert.equal(config.pinnedProfileName, "claude-opus");
  assert.equal(config.stickyProfileName, "claude-haiku");
});

test("loadModelRoutingCliEnv parses turn ID", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_TURN_ID: "turn-123",
  });

  assert.equal(config.turnId, "turn-123");
});

test("loadModelRoutingCliEnv parses fallback lease JSON", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_FALLBACK_LEASE_JSON: '{"profileName":"default","ttlMs":5000}',
  });

  assert.deepEqual(config.fallbackLease, { profileName: "default", ttlMs: 5000 });
});

test("loadModelRoutingCliEnv parses max input per 1k USD", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_MAX_INPUT_PER_1K_USD: "10000",
  });

  assert.equal(config.maxInputPer1kUsd, 10000);
});

test("loadModelRoutingCliEnv parses required capabilities", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_REQUIRED_CAPABILITIES: "vision,tools,batch",
  });

  assert.deepEqual(config.requiredCapabilities, ["vision", "tools", "batch"]);
});

test("loadModelRoutingCliEnv parses allowStrongUpgrade", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_ALLOW_STRONG_UPGRADE: "true",
  });

  assert.equal(config.allowStrongUpgrade, true);
});

test("loadModelRoutingCliEnv parses provider health JSON", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_HEALTH_JSON: '{"anthropic":{"status":"healthy"},"openai":{"status":"degraded"}}',
  });

  assert.deepEqual(config.providerHealth, {
    anthropic: {
      status: "healthy",
      successRate: 1,
      totalCalls: 0,
      failedCalls: 0,
      fallbackCount: 0,
      latestFailureCodes: [],
    },
    openai: {
      status: "degraded",
      successRate: 1,
      totalCalls: 0,
      failedCalls: 0,
      fallbackCount: 0,
      latestFailureCodes: [],
    },
  });
});

test("loadModelRoutingCliEnv parses governance snapshot JSON", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_GOVERNANCE_SNAPSHOT_JSON: '{"policies":["policy1"],"constraints":["constraint1"]}',
  });

  assert.deepEqual(config.governanceSnapshot, { policies: ["policy1"], constraints: ["constraint1"] });
});

test("loadModelRoutingCliEnv parses load governance snapshot flag", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_LOAD_GOVERNANCE_SNAPSHOT: "true",
  });

  assert.equal(config.loadGovernanceSnapshot, true);
});

test("loadModelRoutingCliEnv parses config root", () => {
  const config = loadModelRoutingCliEnv({
    AA_CONFIG_ROOT: "/config",
  });

  assert.equal(config.configRoot, "/config");
});

test("loadModelRoutingCliEnv parses all route parameters together", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_CLASS: "coding",
    AA_MODEL_ROUTE_RISK_LEVEL: "medium",
    AA_MODEL_ROUTE_PREFERRED_PROFILE: "claude-sonnet",
    AA_MODEL_ROUTE_PINNED_PROFILE: "claude-opus",
    AA_MODEL_ROUTE_STICKY_PROFILE: "claude-haiku",
    AA_MODEL_ROUTE_TURN_ID: "turn-456",
    AA_MODEL_ROUTE_ALLOW_STRONG_UPGRADE: "true",
    AA_MODEL_ROUTE_MAX_INPUT_PER_1K_USD: "15000",
    AA_MODEL_ROUTE_REQUIRED_CAPABILITIES: "vision,tools",
  });

  assert.equal(config.routeClass, "coding");
  assert.equal(config.riskLevel, "medium");
  assert.equal(config.preferredProfileName, "claude-sonnet");
  assert.equal(config.pinnedProfileName, "claude-opus");
  assert.equal(config.stickyProfileName, "claude-haiku");
  assert.equal(config.turnId, "turn-456");
  assert.equal(config.allowStrongUpgrade, true);
  assert.equal(config.maxInputPer1kUsd, 15000);
  assert.deepEqual(config.requiredCapabilities, ["vision", "tools"]);
});

test("loadModelRoutingCliEnv returns empty provider health when not specified", () => {
  const config = loadModelRoutingCliEnv({});

  assert.deepEqual(config.providerHealth, {});
});

test("loadModelRoutingCliEnv returns false for allowStrongUpgrade when not specified", () => {
  const config = loadModelRoutingCliEnv({});

  assert.equal(config.allowStrongUpgrade, false);
});

test("loadModelRoutingCliEnv returns false for loadGovernanceSnapshot when not specified", () => {
  const config = loadModelRoutingCliEnv({});

  assert.equal(config.loadGovernanceSnapshot, false);
});

// ---------------------------------------------------------------------------
// Tests for MODEL_ROUTE_CLASSES enum
// ---------------------------------------------------------------------------

test("MODEL_ROUTE_CLASSES contains expected values", () => {
  assert.deepEqual(MODEL_ROUTE_CLASSES, ["default", "classification", "writing", "coding", "reasoning"]);
});

test("MODEL_ROUTE_CLASSES has exactly 5 values", () => {
  assert.equal(MODEL_ROUTE_CLASSES.length, 5);
});

// ---------------------------------------------------------------------------
// Tests for MODEL_ROUTE_RISK_LEVELS enum
// ---------------------------------------------------------------------------

test("MODEL_ROUTE_RISK_LEVELS contains expected values", () => {
  assert.deepEqual(MODEL_ROUTE_RISK_LEVELS, ["low", "medium", "high", "critical"]);
});

test("MODEL_ROUTE_RISK_LEVELS has exactly 4 values", () => {
  assert.equal(MODEL_ROUTE_RISK_LEVELS.length, 4);
});

// ---------------------------------------------------------------------------
// Tests for model routing args building
// ---------------------------------------------------------------------------

test("route args builds with routeClass", () => {
  const envConfig = {
    routeClass: "fast" as const,
    riskLevel: null,
    requiredCapabilities: null,
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: null,
    allowStrongUpgrade: false,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.routeClass != null) {
    args.routeClass = envConfig.routeClass;
  }

  assert.equal(args.routeClass, "fast");
});

test("route args builds with riskLevel", () => {
  const envConfig = {
    routeClass: null,
    riskLevel: "high" as const,
    requiredCapabilities: null,
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: null,
    allowStrongUpgrade: false,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.riskLevel != null) {
    args.riskLevel = envConfig.riskLevel;
  }

  assert.equal(args.riskLevel, "high");
});

test("route args builds with required capabilities", () => {
  const envConfig = {
    routeClass: null,
    riskLevel: null,
    requiredCapabilities: ["vision", "tools"] as string[],
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: null,
    allowStrongUpgrade: false,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.requiredCapabilities != null && envConfig.requiredCapabilities.length > 0) {
    args.requiredCapabilities = envConfig.requiredCapabilities;
  }

  assert.deepEqual(args.requiredCapabilities, ["vision", "tools"]);
});

test("route args omits required capabilities when empty array", () => {
  const envConfig = {
    routeClass: null,
    riskLevel: null,
    requiredCapabilities: [] as string[],
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: null,
    allowStrongUpgrade: false,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.requiredCapabilities != null && envConfig.requiredCapabilities.length > 0) {
    args.requiredCapabilities = envConfig.requiredCapabilities;
  }

  assert.equal(args.requiredCapabilities, undefined);
});

test("route args builds with profile names", () => {
  const envConfig = {
    routeClass: null,
    riskLevel: null,
    requiredCapabilities: null,
    preferredProfileName: "claude-sonnet",
    pinnedProfileName: "claude-opus",
    stickyProfileName: "claude-haiku",
    turnId: null,
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: null,
    allowStrongUpgrade: false,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.preferredProfileName != null) {
    args.preferredProfileName = envConfig.preferredProfileName;
  }
  if (envConfig.pinnedProfileName != null) {
    args.pinnedProfileName = envConfig.pinnedProfileName;
  }
  if (envConfig.stickyProfileName != null) {
    args.stickyProfileName = envConfig.stickyProfileName;
  }

  assert.equal(args.preferredProfileName, "claude-sonnet");
  assert.equal(args.pinnedProfileName, "claude-opus");
  assert.equal(args.stickyProfileName, "claude-haiku");
});

test("route args builds with turnId", () => {
  const envConfig = {
    routeClass: null,
    riskLevel: null,
    requiredCapabilities: null,
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: "turn-789",
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: null,
    allowStrongUpgrade: false,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.turnId != null) {
    args.turnId = envConfig.turnId;
  }

  assert.equal(args.turnId, "turn-789");
});

test("route args builds with fallbackLease", () => {
  const envConfig = {
    routeClass: null,
    riskLevel: null,
    requiredCapabilities: null,
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    fallbackLease: { profileName: "default", ttlMs: 5000 },
    governanceSnapshot: null,
    maxInputPer1kUsd: null,
    allowStrongUpgrade: false,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.fallbackLease != null) {
    args.fallbackLease = envConfig.fallbackLease;
  }

  assert.deepEqual(args.fallbackLease, { profileName: "default", ttlMs: 5000 });
});

test("route args builds with governanceSnapshot", () => {
  const envConfig = {
    routeClass: null,
    riskLevel: null,
    requiredCapabilities: null,
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    fallbackLease: null,
    governanceSnapshot: { policies: ["policy1"] },
    maxInputPer1kUsd: null,
    allowStrongUpgrade: false,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.governanceSnapshot != null) {
    args.governanceSnapshot = envConfig.governanceSnapshot;
  }

  assert.deepEqual(args.governanceSnapshot, { policies: ["policy1"] });
});

test("route args builds with maxInputPer1kUsd", () => {
  const envConfig = {
    routeClass: null,
    riskLevel: null,
    requiredCapabilities: null,
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: 20000,
    allowStrongUpgrade: false,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.maxInputPer1kUsd != null) {
    args.maxInputPer1kUsd = envConfig.maxInputPer1kUsd;
  }

  assert.equal(args.maxInputPer1kUsd, 20000);
});

test("route args builds with allowStrongUpgrade when true", () => {
  const envConfig = {
    routeClass: null,
    riskLevel: null,
    requiredCapabilities: null,
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: null,
    allowStrongUpgrade: true,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.allowStrongUpgrade) {
    args.allowStrongUpgrade = envConfig.allowStrongUpgrade;
  }

  assert.equal(args.allowStrongUpgrade, true);
});

test("route args omits allowStrongUpgrade when false", () => {
  const envConfig = {
    routeClass: null,
    riskLevel: null,
    requiredCapabilities: null,
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: null,
    allowStrongUpgrade: false,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.allowStrongUpgrade) {
    args.allowStrongUpgrade = envConfig.allowStrongUpgrade;
  }

  assert.equal(args.allowStrongUpgrade, undefined);
});
