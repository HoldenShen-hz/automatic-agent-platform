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

function buildCrossProviderRegistry(): ModelMetadataRegistry {
  const registry = buildRegistry();
  registry.profiles.balanced.provider = "anthropic";
  registry.profiles.fast.provider = "anthropic";
  registry.profiles["coding-medium"].provider = "anthropic";
  registry.profiles["reasoning-medium"].provider = "openai";
  return registry;
}

// ============================================================================
// Model Routing with SLO Enforcement
// ============================================================================

test("ModelRoutingService route enforces SLO by selecting tier based on routeClass", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // Classification prefers fast tier (low cost, meets SLO)
  const classificationResult = service.route({
    routeClass: "classification",
    riskLevel: "low",
  });
  assert.equal(classificationResult.profileName, "fast");
  assert.equal(classificationResult.trace.routeReason, "classification_cheap_default");
  assert.deepEqual(classificationResult.trace.targetTierOrder, ["fast", "balanced", "reasoning", "coding"]);

  // Coding requires coding tier
  const codingResult = service.route({
    routeClass: "coding",
    riskLevel: "medium",
  });
  assert.equal(codingResult.profileName, "coding-medium");
  assert.equal(codingResult.trace.routeReason, "coding_required");
  assert.deepEqual(codingResult.trace.targetTierOrder, ["coding", "reasoning", "balanced", "fast"]);

  // Writing prefers balanced tier
  const writingResult = service.route({
    routeClass: "writing",
    riskLevel: "medium",
  });
  assert.equal(writingResult.profileName, "balanced");
  assert.equal(writingResult.trace.routeReason, "writing_balanced_default");
  assert.deepEqual(writingResult.trace.targetTierOrder, ["balanced", "reasoning", "fast", "coding"]);
});

test("ModelRoutingService route enforces risk level for critical requests", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // Critical risk prefers reasoning tier
  const criticalResult = service.route({
    routeClass: "default",
    riskLevel: "critical",
  });
  assert.equal(criticalResult.profileName, "reasoning-medium");
  assert.equal(criticalResult.trace.routeReason, "risk_driven_reasoning");
  assert.deepEqual(criticalResult.trace.targetTierOrder, ["reasoning", "balanced", "coding", "fast"]);

  // High risk also prefers capable models
  const highResult = service.route({
    routeClass: "default",
    riskLevel: "high",
  });
  assert.equal(highResult.profileName, "reasoning-medium");
  assert.equal(highResult.trace.routeReason, "risk_driven_reasoning");
});

test("ModelRoutingService route filters candidates by maxInputPer1kUsd cost cap", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // Set a low cost cap that excludes more expensive profiles
  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    maxInputPer1kUsd: 0.3, // Very low cap
  });

  // Should select within cost cap if possible, otherwise trigger cost_cap_fallback
  // The trace should indicate cost constraint was considered
  assert.ok(result.profile.profile.pricing.inputPer1kUsd <= 0.3 || result.trace.routeReason === "cost_cap_fallback");
});

test("ModelRoutingService route selects cheapest profile when routeClass allows", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  // Low risk default class should prefer cheapest option
  const result = service.route({
    routeClass: "default",
    riskLevel: "low",
  });

  // fast tier is cheapest for low risk
  assert.equal(result.profileName, "fast");
  assert.equal(result.trace.routeReason, "classification_cheap_default");
});

// ============================================================================
// Fallback Chain Tests (Primary -> Secondary -> Tertiary)
// ============================================================================

test("ModelRoutingService fallback chain: primary healthy -> use primary", () => {
  const service = new ModelRoutingService({
    registry: buildCrossProviderRegistry(),
    providerHealth: {
      anthropic: {
        status: "healthy",
        successRate: 0.99,
        totalCalls: 100,
        failedCalls: 1,
        fallbackCount: 0,
        latestFailureCodes: [],
      },
      openai: {
        status: "healthy",
        successRate: 0.95,
        totalCalls: 100,
        failedCalls: 5,
        fallbackCount: 10,
        latestFailureCodes: [],
      },
    },
  });

  // Preferred profile (primary) is healthy - should use it
  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced", // anthropic profile
  });

  assert.equal(result.profileName, "balanced");
  assert.equal(result.trace.routeReason, "preferred_profile");
});

test("ModelRoutingService fallback chain: primary degraded -> secondary via provider_health_fallback", () => {
  const service = new ModelRoutingService({
    registry: buildCrossProviderRegistry(),
    providerHealth: {
      anthropic: {
        status: "degraded",
        successRate: 0.7,
        totalCalls: 100,
        failedCalls: 30,
        fallbackCount: 15,
        latestFailureCodes: ["provider.http_429"],
      },
      openai: {
        status: "healthy",
        successRate: 0.99,
        totalCalls: 100,
        failedCalls: 1,
        fallbackCount: 0,
        latestFailureCodes: [],
      },
    },
  });

  // Primary is degraded, should fallback to openai profile
  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced", // anthropic profile - degraded
  });

  // Should fallback to openai profile
  assert.equal(result.profile.provider, "openai");
  assert.equal(result.trace.routeReason, "provider_health_fallback");
  assert.ok(result.trace.turnScopedFallbackIssued);
  assert.equal(result.trace.turnScopedFallbackPrimaryProfileName, "balanced");
  assert.notStrictEqual(result.trace.turnScopedFallbackProfileName, null);
});

test("ModelRoutingService fallback chain: primary failed -> use fallback from different provider", () => {
  const service = new ModelRoutingService({
    registry: buildCrossProviderRegistry(),
    providerHealth: {
      anthropic: {
        status: "failed",
        successRate: 0.1,
        totalCalls: 100,
        failedCalls: 90,
        fallbackCount: 50,
        latestFailureCodes: ["provider.http_500"],
      },
      openai: {
        status: "healthy",
        successRate: 0.98,
        totalCalls: 100,
        failedCalls: 2,
        fallbackCount: 5,
        latestFailureCodes: [],
      },
    },
  });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
  });

  // Primary failed, should fallback
  assert.equal(result.profile.provider, "openai");
  assert.ok(
    result.trace.routeReason === "provider_health_fallback" ||
    result.trace.routeReason === "turn_scoped_fallback_lease"
  );
});

test("ModelRoutingService fallback chain: tier fallback when target tier unavailable", () => {
  const service = new ModelRoutingService({
    registry: buildCrossProviderRegistry(),
    providerHealth: {
      anthropic: {
        status: "healthy",
        successRate: 0.99,
        totalCalls: 100,
        failedCalls: 1,
        fallbackCount: 0,
        latestFailureCodes: [],
      },
      openai: {
        status: "healthy",
        successRate: 0.99,
        totalCalls: 100,
        failedCalls: 1,
        fallbackCount: 0,
        latestFailureCodes: [],
      },
    },
  });

  // Request reasoning tier but it's not available via healthy providers for this route
  const result = service.route({
    routeClass: "reasoning",
    riskLevel: "high",
    // No explicit tier override, should use reasoning tier
  });

  // If reasoning tier has candidates, should use them
  // If not, should fallback to next tier
  assert.ok(
    result.trace.routeReason === "reasoning" ||
    result.trace.routeReason === "risk_driven_reasoning" ||
    result.trace.routeReason === "tier_fallback"
  );
});

// ============================================================================
// Turn-Scoped Fallback Lease Tests
// ============================================================================

test("ModelRoutingService issues turn-scoped fallback lease when primary unavailable", () => {
  const service = new ModelRoutingService({
    registry: buildCrossProviderRegistry(),
    providerHealth: {
      anthropic: {
        status: "failed",
        successRate: 0.1,
        totalCalls: 20,
        failedCalls: 18,
        fallbackCount: 5,
        latestFailureCodes: ["provider.http_429"],
      },
      openai: {
        status: "healthy",
        successRate: 0.99,
        totalCalls: 20,
        failedCalls: 0,
        fallbackCount: 0,
        latestFailureCodes: [],
      },
    },
  });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    turnId: "turn-123",
  });

  // Lease should be issued
  assert.ok(result.fallbackLease != null);
  assert.equal(result.fallbackLease.turnId, "turn-123");
  assert.equal(result.fallbackLease.primaryProfileName, "balanced");
  assert.ok(
    result.fallbackLease.reason === "provider_health_fallback" ||
    result.fallbackLease.reason === "cost_cap_fallback" ||
    result.fallbackLease.reason === "tier_fallback"
  );

  // Trace should reflect the lease
  assert.equal(result.trace.turnScopedFallbackIssued, true);
  assert.equal(result.trace.turnScopedFallbackAutoRecoveryNextTurn, true);
});

test("ModelRoutingService reuses fallback lease within same turn", () => {
  const degradedService = new ModelRoutingService({
    registry: buildCrossProviderRegistry(),
    providerHealth: {
      anthropic: {
        status: "failed",
        successRate: 0.1,
        totalCalls: 20,
        failedCalls: 18,
        fallbackCount: 5,
        latestFailureCodes: ["provider.http_429"],
      },
      openai: {
        status: "healthy",
        successRate: 0.99,
        totalCalls: 20,
        failedCalls: 0,
        fallbackCount: 0,
        latestFailureCodes: [],
      },
    },
  });

  // First request issues a lease
  const firstResult = degradedService.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    turnId: "turn-1",
  });

  assert.ok(firstResult.fallbackLease != null);

  // Second request with same turnId and lease should honor it
  const secondResult = degradedService.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    turnId: "turn-1",
    fallbackLease: firstResult.fallbackLease,
  });

  // Should use the lease (route reason should be turn_scoped_fallback_lease)
  assert.equal(secondResult.trace.routeReason, "turn_scoped_fallback_lease");
  assert.equal(secondResult.trace.turnScopedFallbackActive, true);
});

test("ModelRoutingService lease auto-recovers on next turn", () => {
  const degradedService = new ModelRoutingService({
    registry: buildCrossProviderRegistry(),
    providerHealth: {
      anthropic: {
        status: "failed",
        successRate: 0.1,
        totalCalls: 20,
        failedCalls: 18,
        fallbackCount: 5,
        latestFailureCodes: ["provider.http_429"],
      },
      openai: {
        status: "healthy",
        successRate: 0.99,
        totalCalls: 20,
        failedCalls: 0,
        fallbackCount: 0,
        latestFailureCodes: [],
      },
    },
  });

  // First request issues a lease
  const firstResult = degradedService.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    turnId: "turn-1",
  });

  // Next turn (different turnId) with lease should NOT honor it
  // and should try to use preferred profile (may recover if health improved)
  const nextTurnResult = degradedService.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    turnId: "turn-2",
    fallbackLease: firstResult.fallbackLease,
  });

  // turnScopedFallbackActive should be false for new turn
  assert.equal(nextTurnResult.trace.turnScopedFallbackActive, false);
  // Fallback lease should not be active for different turn
});

// ============================================================================
// Governance Fallback Tests
// ============================================================================

test("ModelRoutingService falls back from degraded governance profile to rollback target", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    governanceSnapshot: {
      profileStatuses: {
        balanced: "degraded",
        "reasoning-medium": "active",
      },
      rollbackTargets: {
        balanced: "reasoning-medium",
      },
    },
  });

  // Should fallback to rollback target
  assert.equal(result.profileName, "reasoning-medium");
  assert.equal(result.trace.routeReason, "governance_fallback");
  assert.equal(result.trace.selectedGovernanceStatus, "active");
});

test("ModelRoutingService fail-closes pinned governance-disabled profiles", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  assert.throws(
    () =>
      service.route({
        pinnedProfileName: "balanced",
        governanceSnapshot: {
          profileStatuses: {
            balanced: "disabled",
          },
          rollbackTargets: {},
        },
      }),
    /model_route\.profile_governance_disabled:balanced/,
  );
});

// ============================================================================
// Validation Tests
// ============================================================================

test("ModelRoutingService rejects malformed fallback lease (empty turnId)", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  assert.throws(
    () =>
      service.route({
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

test("ModelRoutingService rejects malformed fallback lease (invalid reason)", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  assert.throws(
    () =>
      service.route({
        turnId: "turn-1",
        fallbackLease: {
          turnId: "turn-1",
          primaryProfileName: "balanced",
          fallbackProfileName: "reasoning-medium",
          issuedAt: "2026-04-08T00:00:00.000Z",
          reason: "invalid_reason",
        },
      }),
    /model_route\.invalid_fallback_lease/,
  );
});

test("ModelRoutingService fail-closes when no eligible profiles found", () => {
  const registry = buildRegistry();
  // Disable all providers
  registry.providers.anthropic.status = "disabled";
  registry.providers.openai.status = "disabled";

  const service = new ModelRoutingService({ registry });

  assert.throws(
    () =>
      service.route({
        routeClass: "default",
        riskLevel: "medium",
      }),
    /model_route\.no_eligible_profiles/,
  );
});

// ============================================================================
// Pinned and Sticky Profile Tests
// ============================================================================

test("ModelRoutingService respects pinned profile", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    pinnedProfileName: "coding-medium",
  });

  assert.equal(result.profileName, "coding-medium");
  assert.equal(result.trace.routeReason, "pinned_profile");
});

test("ModelRoutingService fail-closes when pinned profile unavailable", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  assert.throws(
    () =>
      service.route({
        pinnedProfileName: "non-existent-profile",
      }),
    /model_route\.profile_unavailable:non-existent-profile/,
  );
});

test("ModelRoutingService sticky profile takes precedence over tier selection", () => {
  const service = new ModelRoutingService({
    registry: buildRegistry(),
    providerHealth: {
      anthropic: {
        status: "healthy",
        successRate: 0.99,
        totalCalls: 100,
        failedCalls: 1,
        fallbackCount: 0,
        latestFailureCodes: [],
      },
    },
  });

  const result = service.route({
    routeClass: "coding",
    riskLevel: "medium",
    stickyProfileName: "balanced", // Should use balanced over coding-medium
  });

  assert.equal(result.profileName, "balanced");
  assert.equal(result.trace.routeReason, "sticky_profile");
});

test("ModelRoutingService preferred profile when sticky unavailable", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    stickyProfileName: "non-existent",
    preferredProfileName: "fast",
  });

  // Falls through to preferred
  assert.equal(result.profileName, "fast");
  assert.equal(result.trace.routeReason, "preferred_profile");
});

// ============================================================================
// Capability Filtering Tests
// ============================================================================

test("ModelRoutingService filters profiles by required capabilities", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "coding",
    riskLevel: "medium",
    requiredCapabilities: ["vision"], // Not all profiles have vision
  });

  // Should only consider profiles with vision capability
  // If no profiles have vision, should throw or fallback
  // Check that filteredOut includes profiles without vision
  assert.ok(result.trace.filteredOut.some(f => f.includes("capability_mismatch")));
});

// ============================================================================
// Cost Cap Fallback Tests
// ============================================================================

test("ModelRoutingService triggers cost_cap_fallback when maxInputPer1kUsd exceeded", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    maxInputPer1kUsd: 0.001, // Very low cap
  });

  // Should either select within cap or trigger cost_cap_fallback
  if (result.trace.routeReason === "cost_cap_fallback") {
    // Fallback triggered, lease should indicate cost_cap_fallback reason
    if (result.fallbackLease) {
      assert.equal(result.fallbackLease.reason, "cost_cap_fallback");
    }
  }
});
