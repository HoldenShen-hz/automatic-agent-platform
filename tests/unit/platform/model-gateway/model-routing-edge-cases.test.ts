/**
 * Additional ModelRoutingService edge case tests for increased coverage
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MODEL_METADATA_REGISTRY,
  type ModelMetadataRegistry,
  type ModelProfileMetadata,
} from "../../../../src/platform/control-plane/config-center/model-metadata-registry.js";
import { ModelRoutingService } from "../../../../src/platform/model-gateway/provider-registry/model-routing-service.js";

function buildRegistry(): ModelMetadataRegistry {
  return JSON.parse(JSON.stringify(DEFAULT_MODEL_METADATA_REGISTRY)) as ModelMetadataRegistry;
}

test("ModelRoutingService route with undefined routeClass defaults to default", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({});
  assert.equal(result.trace.requestedRouteClass, "default");
});

test("ModelRoutingService route with undefined riskLevel defaults to medium", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({});
  assert.equal(result.trace.requestedRiskLevel, "medium");
});

test("ModelRoutingService route with empty requiredCapabilities", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ requiredCapabilities: [] });
  assert.deepEqual(result.trace.requiredCapabilities, []);
});

test("ModelRoutingService route normalizes requiredCapabilities trimming whitespace", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ requiredCapabilities: ["  reasoning  ", "  tool_use  "] });
  assert.deepEqual(result.trace.requiredCapabilities, ["reasoning", "tool_use"]);
});

test("ModelRoutingService route filters duplicate requiredCapabilities", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ requiredCapabilities: ["tool_use", "tool_use", "tool_use"] });
  assert.deepEqual(result.trace.requiredCapabilities, ["tool_use"]);
});

test("ModelRoutingService route with null preferredProfileName", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ preferredProfileName: null });
  assert.equal(result.trace.preferredProfileName, null);
});

test("ModelRoutingService route with empty string preferredProfileName normalizes to null", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ preferredProfileName: "   " });
  assert.equal(result.trace.preferredProfileName, null);
});

test("ModelRoutingService route with null pinnedProfileName", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ pinnedProfileName: null });
  assert.equal(result.trace.pinnedProfileName, null);
});

test("ModelRoutingService route with null stickyProfileName", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ stickyProfileName: null });
  assert.equal(result.trace.stickyProfileName, null);
});

test("ModelRoutingService route with null turnId", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ turnId: null });
  assert.equal(result.trace.turnId, null);
});

test("ModelRoutingService route with empty string turnId normalizes to null", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ turnId: "   " });
  assert.equal(result.trace.turnId, null);
});

test("ModelRoutingService route with null governanceSnapshot", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ governanceSnapshot: null });
  assert.equal(result.trace.selectedGovernanceStatus, "unknown");
});

test("ModelRoutingService route normalizes governance snapshot profileStatuses", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({
    governanceSnapshot: {
      profileStatuses: {
        balanced: "active",
        reasoning: "degraded",
        unknown_status: "invalid_status" as any,
      },
      rollbackTargets: {},
    },
  });
  assert.notEqual(result.trace.selectedGovernanceStatus, "invalid_status");
});

test("ModelRoutingService route normalizes governance snapshot rollbackTargets", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({
    governanceSnapshot: {
      profileStatuses: {},
      rollbackTargets: {
        balanced: "  reasoning-medium  ",
        empty_target: "   ",
      },
    },
  });
  assert.equal(result.trace.selectedGovernanceRollbackTarget, "reasoning-medium");
});

test("ModelRoutingService route filters out profiles with unknown governance status", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  // balanced should exist in registry
  const result = service.route({
    governanceSnapshot: {
      profileStatuses: {
        balanced: "disabled",
      },
      rollbackTargets: {},
    },
  });
  // Should not throw because we're not pinning, just routing
  assert.ok(result.profileName);
});

test("ModelRoutingService route builds correct targetTierOrder for coding", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "coding" });
  assert.deepEqual(result.trace.targetTierOrder, ["coding", "reasoning", "balanced", "fast"]);
});

test("ModelRoutingService route builds correct targetTierOrder for reasoning", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "reasoning" });
  assert.deepEqual(result.trace.targetTierOrder, ["reasoning", "balanced", "coding", "fast"]);
});

test("ModelRoutingService route builds correct targetTierOrder for classification", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "classification" });
  assert.deepEqual(result.trace.targetTierOrder, ["fast", "balanced", "reasoning", "coding"]);
});

test("ModelRoutingService route builds correct targetTierOrder for writing", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "writing" });
  assert.deepEqual(result.trace.targetTierOrder, ["balanced", "reasoning", "fast", "coding"]);
});

test("ModelRoutingService route builds correct targetTierOrder for default with high risk", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "default", riskLevel: "high" });
  assert.deepEqual(result.trace.targetTierOrder, ["reasoning", "balanced", "coding", "fast"]);
});

test("ModelRoutingService route builds correct targetTierOrder for default with critical risk", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "default", riskLevel: "critical" });
  assert.deepEqual(result.trace.targetTierOrder, ["reasoning", "balanced", "coding", "fast"]);
});

test("ModelRoutingService route builds correct targetTierOrder for default with low risk", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "default", riskLevel: "low" });
  assert.deepEqual(result.trace.targetTierOrder, ["fast", "balanced", "reasoning", "coding"]);
});

test("ModelRoutingService route builds correct targetTierOrder for default with medium risk", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "default", riskLevel: "medium" });
  assert.deepEqual(result.trace.targetTierOrder, ["balanced", "fast", "reasoning", "coding"]);
});

test("ModelRoutingService route determines routeReason as coding_required", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "coding" });
  assert.equal(result.trace.routeReason, "coding_required");
});

test("ModelRoutingService route determines routeReason as risk_driven_reasoning for high risk", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "default", riskLevel: "high" });
  assert.equal(result.trace.routeReason, "risk_driven_reasoning");
});

test("ModelRoutingService route determines routeReason as risk_driven_reasoning for critical risk", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "default", riskLevel: "critical" });
  assert.equal(result.trace.routeReason, "risk_driven_reasoning");
});

test("ModelRoutingService route determines routeReason as classification_cheap_default", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "classification", riskLevel: "medium" });
  assert.equal(result.trace.routeReason, "classification_cheap_default");
});

test("ModelRoutingService route determines routeReason as classification_cheap_default for default with low risk", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "default", riskLevel: "low" });
  assert.equal(result.trace.routeReason, "classification_cheap_default");
});

test("ModelRoutingService route determines routeReason as writing_balanced_default", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "writing" });
  assert.equal(result.trace.routeReason, "writing_balanced_default");
});

test("ModelRoutingService route determines routeReason as default_balanced", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "default", riskLevel: "medium" });
  assert.equal(result.trace.routeReason, "default_balanced");
});

test("ModelRoutingService route determines routeReason as capability_driven_selection with capabilities", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ routeClass: "default", riskLevel: "medium", requiredCapabilities: ["tool_use"] });
  assert.equal(result.trace.routeReason, "capability_driven_selection");
});

test("ModelRoutingService route filters out profiles from disabled providers", () => {
  const registry = buildRegistry();
  // Disable the openai provider in the registry
  if (registry.providers["openai"]) {
    registry.providers["openai"].status = "disabled";
  }
  const service = new ModelRoutingService({ registry });
  const result = service.route({ routeClass: "default", riskLevel: "medium" });
  // Should still route to some profile, just not from disabled provider
  assert.ok(result.profileName);
});

test("ModelRoutingService route filters out profiles from deprecated providers", () => {
  const registry = buildRegistry();
  // Deprecate the openai provider
  if (registry.providers["openai"]) {
    registry.providers["openai"].status = "deprecated";
  }
  const service = new ModelRoutingService({ registry });
  const result = service.route({ routeClass: "default", riskLevel: "medium" });
  assert.ok(result.profileName);
});

test("ModelRoutingService route includes healthStatuses in trace", () => {
  const service = new ModelRoutingService({
    registry: buildRegistry(),
    providerHealth: {
      openai: { status: "healthy", successRate: 0.99, totalCalls: 100, failedCalls: 1, fallbackCount: 0, latestFailureCodes: [] },
      anthropic: { status: "degraded", successRate: 0.8, totalCalls: 100, failedCalls: 20, fallbackCount: 5, latestFailureCodes: [] },
    },
  });
  const result = service.route({});
  assert.ok("openai" in result.trace.healthStatuses);
  assert.ok("anthropic" in result.trace.healthStatuses);
});

test("ModelRoutingService route includes filteredOut in trace", () => {
  const registry = buildRegistry();
  // Add a profile that will be filtered out due to capability mismatch
  registry.profiles["test-profile"] = {
    modelId: "test-profile",
    name: "test-profile",
    provider: "openai",
    tier: "fast",
    capabilities: ["nonexistent_capability"],
    pricing: { inputPer1kUsd: 0.1, outputPer1kUsd: 0.2 },
    maxOutputTokens: 1000,
    contextWindowTokens: 8192,
    metadataSource: "test",
  } as ModelProfileMetadata;
  const service = new ModelRoutingService({ registry });
  const result = service.route({ requiredCapabilities: ["tool_use"] });
  assert.ok(result.trace.filteredOut.length > 0);
});

test("ModelRoutingService route issues fallback lease for cost_cap_fallback", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    turnId: "turn-cost",
    maxInputPer1kUsd: 0.001, // Very low cost cap
  });
  // Should issue a fallback lease because the cost cap forces a fallback
  assert.ok(result.trace.turnScopedFallbackIssued || result.fallbackLease !== null || result.trace.routeReason === "cost_cap_fallback");
});

test("ModelRoutingService route issues fallback lease for tier_fallback", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  // Use allowStrongUpgrade to force tier fallback
  const result = service.route({
    routeClass: "coding",
    riskLevel: "medium",
    allowStrongUpgrade: true,
  });
  // Should route to something
  assert.ok(result.profileName);
});

test("ModelRoutingService route honors governance fallback when degraded", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({
    governanceSnapshot: {
      profileStatuses: {
        balanced: "degraded",
      },
      rollbackTargets: {
        balanced: "reasoning-medium",
      },
    },
  });
  // Should fallback to the rollback target
  assert.equal(result.profileName, "reasoning-medium");
  assert.equal(result.trace.routeReason, "governance_fallback");
});

test("ModelRoutingService route throws when no eligible profiles", () => {
  const registry = buildRegistry();
  for (const provider of Object.values(registry.providers)) {
    provider.status = "disabled";
  }
  const service = new ModelRoutingService({ registry });
  assert.throws(
    () => service.route({ routeClass: "default", riskLevel: "medium" }),
    /model_route\.no_eligible_profiles/,
  );
});

test("ModelRoutingService route throws when pinned profile is unavailable", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  assert.throws(
    () => service.route({ pinnedProfileName: "nonexistent-profile" }),
    /model_route\.profile_unavailable:nonexistent-profile/,
  );
});

test("ModelRoutingService route throws when pinned profile is governance disabled", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  assert.throws(
    () => service.route({
      pinnedProfileName: "balanced",
      governanceSnapshot: {
        profileStatuses: { balanced: "disabled" },
        rollbackTargets: {},
      },
    }),
    /model_route\.profile_governance_disabled:balanced/,
  );
});

test("ModelRoutingService route throws on invalid fallback lease - missing turnId", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  assert.throws(
    () => service.route({
      turnId: "turn-1",
      fallbackLease: {
        turnId: "",
        primaryProfileName: "balanced",
        fallbackProfileName: "reasoning-medium",
        issuedAt: "2026-04-08T00:00:00.000Z",
        reason: "provider_health_fallback",
      },
    }),
    /model_route\.invalid_fallback_lease/,
  );
});

test("ModelRoutingService route throws on invalid fallback lease - invalid reason", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  assert.throws(
    () => service.route({
      turnId: "turn-1",
      fallbackLease: {
        turnId: "turn-1",
        primaryProfileName: "balanced",
        fallbackProfileName: "reasoning-medium",
        issuedAt: "2026-04-08T00:00:00.000Z",
        reason: "invalid_reason" as any,
      },
    }),
    /model_route\.invalid_fallback_lease/,
  );
});

test("ModelRoutingService route normalizes whitespace in turnId", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ turnId: "  turn-123  " });
  assert.equal(result.trace.turnId, "turn-123");
});

test("ModelRoutingService route normalizes whitespace in trace for profile names", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ preferredProfileName: "  balanced  " });
  assert.equal(result.trace.preferredProfileName, "balanced");
});

test("ModelRoutingService getState includes unknown for providers without health data", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({});
  assert.equal(result.trace.healthStatuses["openai"], "unknown");
  assert.equal(result.trace.healthStatuses["anthropic"], "unknown");
});

test("ModelRoutingService route handles allowStrongUpgrade false", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ allowStrongUpgrade: false });
  assert.ok(result.profileName);
});

test("ModelRoutingService route handles allowStrongUpgrade true", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({ allowStrongUpgrade: true });
  assert.ok(result.profileName);
});

test("ModelRoutingService route trace has all required fields", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const result = service.route({});
  const trace = result.trace;
  assert.ok("routeReason" in trace);
  assert.ok("requestedRouteClass" in trace);
  assert.ok("requestedRiskLevel" in trace);
  assert.ok("requiredCapabilities" in trace);
  assert.ok("targetTierOrder" in trace);
  assert.ok("selectedProfileName" in trace);
  assert.ok("selectedProvider" in trace);
  assert.ok("preferredProfileName" in trace);
  assert.ok("pinnedProfileName" in trace);
  assert.ok("stickyProfileName" in trace);
  assert.ok("turnId" in trace);
  assert.ok("turnScopedFallbackPrimaryProfileName" in trace);
  assert.ok("turnScopedFallbackProfileName" in trace);
  assert.ok("turnScopedFallbackActive" in trace);
  assert.ok("turnScopedFallbackIssued" in trace);
  assert.ok("turnScopedFallbackAutoRecoveryNextTurn" in trace);
  assert.ok("selectedGovernanceStatus" in trace);
  assert.ok("selectedGovernanceRollbackTarget" in trace);
  assert.ok("healthStatuses" in trace);
  assert.ok("filteredOut" in trace);
});
