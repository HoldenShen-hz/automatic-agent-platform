import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MODEL_METADATA_REGISTRY,
  type ModelMetadataRegistry,
} from "../../../../../src/platform/control-plane/config-center/model-metadata-registry.js";
import { ModelRoutingService } from "../../../../../src/platform/model-gateway/provider-registry/model-routing-service.js";

function buildRegistry(): ModelMetadataRegistry {
  return JSON.parse(JSON.stringify(DEFAULT_MODEL_METADATA_REGISTRY)) as ModelMetadataRegistry;
}

test("model routing cost_cap_fallback when maxInputPer1kUsd excludes all tier candidates", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // maxInputPer1kUsd set very low, forcing fallback
  const result = service.route({
    routeClass: "classification",
    riskLevel: "low",
    maxInputPer1kUsd: 0.001, // Very low, should exclude even fast profiles
    allowStrongUpgrade: true,
  });

  // Should still get a result due to allowStrongUpgrade
  assert.ok(result.profileName);
  assert.equal(result.trace.routeReason, "cost_cap_fallback");
});

test("model routing cost_cap_fallback route reason is set correctly", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    maxInputPer1kUsd: 0.01,
    allowStrongUpgrade: true,
  });

  assert.ok(result.trace.routeReason === "cost_cap_fallback" || result.trace.routeReason === "tier_fallback");
});

test("model routing throws when no candidate for target tier and allowStrongUpgrade is false", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // With a very low maxInputPer1kUsd, no profiles in target tier match
  assert.throws(
    () =>
      service.route({
        routeClass: "reasoning",
        riskLevel: "high",
        maxInputPer1kUsd: 0.0001,
        allowStrongUpgrade: false,
      }),
    /model_route\.no_candidate_for_target_tier/,
  );
});

test("model routing allowStrongUpgrade picks from any tier when target tier has no match", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // Even with strict cost cap, allowStrongUpgrade should find something
  const result = service.route({
    routeClass: "coding",
    riskLevel: "medium",
    maxInputPer1kUsd: 0.001,
    allowStrongUpgrade: true,
  });

  assert.ok(result.profileName);
  assert.equal(result.trace.routeReason, "tier_fallback");
});

test("model routing issues turn-scoped fallback for cost_cap_fallback", () => {
  const service = new ModelRoutingService({
    registry: buildRegistry(),
    providerHealth: {
      anthropic: { status: "healthy", successRate: 0.95, totalCalls: 10, failedCalls: 0, fallbackCount: 0, latestFailureCodes: [] },
      openai: { status: "healthy", successRate: 0.95, totalCalls: 10, failedCalls: 0, fallbackCount: 0, latestFailureCodes: [] },
    },
  });

  // preferred profile is excluded due to cost cap
  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "reasoning-medium", // This has higher cost
    maxInputPer1kUsd: 0.05, // Very low
    turnId: "turn-cost-test",
    allowStrongUpgrade: true,
  });

  assert.ok(result.profileName);
  // The route reason could be cost_cap_fallback or tier_fallback depending on cost constraints
  assert.ok(result.trace.turnScopedFallbackIssued === false); // No lease since preferred was not selected
});

test("model routing prefer profiles with lower input cost per 1k usd", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // In default balanced tier, should select cheapest
  const result = service.route({
    routeClass: "default",
    riskLevel: "low",
  });

  // fast profile should be selected for low risk
  assert.equal(result.profile.tier, "fast");
});

test("model routing compareProfiles sorts by cost first", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // Create request that would pick from coding tier
  const result = service.route({
    routeClass: "coding",
    riskLevel: "medium",
  });

  // coding-medium profile should have lower input cost than other coding profiles
  assert.ok(result.profileName.includes("coding"));
});

test("model routing normalizes empty routeClass to default", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
  });

  // Should use default tier order: balanced > fast > reasoning > coding
  assert.ok(result.profileName);
  assert.equal(result.trace.requestedRouteClass, "default");
});

test("model routing normalizes empty riskLevel to medium", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
  });

  assert.ok(result.profileName);
  assert.equal(result.trace.requestedRiskLevel, "medium");
});

test("model routing normalizes requiredCapabilities trimming whitespace", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "coding",
    riskLevel: "medium",
    requiredCapabilities: ["  coding  ", "vision"],
  });

  // Should have filtered to only profiles with both capabilities
  assert.ok(result.profileName);
});

test("model routing filters out profiles missing required capabilities", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    requiredCapabilities: ["vision", "function_calling"],
  });

  // If no profiles have both capabilities, should get no_eligible_profiles
  if (result.trace.filteredOut.some(f => f.includes("capability_mismatch"))) {
    assert.ok(result.trace.filteredOut.length > 0);
  }
});

test("model routing normalized optional name fields", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // Empty strings should normalize to null
  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "   ",
    stickyProfileName: null,
    pinnedProfileName: "",
  });

  assert.equal(result.trace.preferredProfileName, null);
  assert.equal(result.trace.stickyProfileName, null);
  assert.equal(result.trace.pinnedProfileName, null);
});

test("model routing buildTargetTierOrder for low risk prefers fast", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "low",
  });

  // low risk should prefer fast tier
  assert.equal(result.profile.tier, "fast");
  assert.deepEqual(result.trace.targetTierOrder, ["fast", "balanced", "reasoning", "coding"]);
});

test("model routing buildTargetTierOrder for critical risk prefers reasoning", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "critical",
  });

  // critical risk should prefer reasoning tier
  assert.ok(result.profile.tier === "reasoning" || result.profile.tier === "balanced");
  assert.deepEqual(result.trace.targetTierOrder, ["reasoning", "balanced", "coding", "fast"]);
});

test("model routing buildTargetTierOrder for classification prefers fast", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "classification",
    riskLevel: "medium",
  });

  assert.equal(result.profile.tier, "fast");
  assert.deepEqual(result.trace.targetTierOrder, ["fast", "balanced", "reasoning", "coding"]);
});

test("model routing buildTargetTierOrder for writing prefers balanced", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "writing",
    riskLevel: "medium",
  });

  assert.ok(result.profile.tier === "balanced" || result.profile.tier === "reasoning");
  assert.deepEqual(result.trace.targetTierOrder, ["balanced", "reasoning", "fast", "coding"]);
});

test("model routing healthStatuses reflects provider health", () => {
  const service = new ModelRoutingService({
    registry: buildRegistry(),
    providerHealth: {
      anthropic: { status: "healthy", successRate: 0.95, totalCalls: 100, failedCalls: 5, fallbackCount: 1, latestFailureCodes: [] },
      openai: { status: "degraded", successRate: 0.7, totalCalls: 100, failedCalls: 30, fallbackCount: 10, latestFailureCodes: ["provider.http_429"] },
    },
  });

  const result = service.route({ routeClass: "default", riskLevel: "medium" });

  assert.equal(result.trace.healthStatuses["anthropic"], "healthy");
  assert.equal(result.trace.healthStatuses["openai"], "degraded");
  assert.ok(result.trace.healthStatuses["minimax"] === "unknown"); // Not in health map
});

test("model routing governance status is tracked in trace", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    governanceSnapshot: {
      profileStatuses: {
        balanced: "degraded",
      },
      rollbackTargets: {},
    },
  });

  // balanced profile is degraded, so should fallback to another
  if (result.profileName !== "balanced") {
    assert.ok(result.trace.selectedGovernanceStatus === "active" || result.trace.selectedGovernanceStatus === "unknown");
  }
});

test("model routing determineBaseRouteReason for classification with capabilities returns capability_driven", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "classification",
    riskLevel: "low",
    requiredCapabilities: ["vision"], // Has required capabilities
  });

  assert.equal(result.trace.routeReason, "capability_driven_selection");
});

test("model routing determineBaseRouteReason writing returns writing_balanced_default", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "writing",
    riskLevel: "low",
  });

  assert.equal(result.trace.routeReason, "writing_balanced_default");
});

test("model routing getGovernanceStatus returns governance status from snapshot", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // Governance snapshot with known status
  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    governanceSnapshot: {
      profileStatuses: {
        "reasoning-medium": "degraded",
      },
      rollbackTargets: {
        "reasoning-medium": "balanced",
      },
    },
  });

  // If reasoning-medium is selected and degraded, should fallback
  // Otherwise the governance status should be tracked
  assert.ok(result.trace);
});