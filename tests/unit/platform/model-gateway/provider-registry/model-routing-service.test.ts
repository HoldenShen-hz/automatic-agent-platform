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

test("model routing chooses cheap fast profile for low-risk classification traffic", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "classification",
    riskLevel: "low",
  });

  assert.equal(result.profileName, "fast");
  assert.equal(result.trace.routeReason, "classification_cheap_default");
});

test("model routing escalates to coding profile when coding is explicitly required", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "coding",
    riskLevel: "medium",
    requiredCapabilities: ["coding"],
  });

  assert.equal(result.profileName, "coding-medium");
  assert.equal(result.trace.routeReason, "coding_required");
});

test("model routing escalates to reasoning profile for high-risk requests", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const result = service.route({
    routeClass: "default",
    riskLevel: "critical",
  });

  assert.equal(result.profileName, "reasoning-medium");
  assert.equal(result.trace.routeReason, "risk_driven_reasoning");
});

test("model routing reuses healthy sticky profile before recomputing route", () => {
  const service = new ModelRoutingService({
    registry: buildRegistry(),
    providerHealth: {
      anthropic: {
        status: "healthy",
        successRate: 0.99,
        totalCalls: 12,
        failedCalls: 0,
        fallbackCount: 0,
        latestFailureCodes: [],
      },
    },
  });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    stickyProfileName: "balanced",
  });

  assert.equal(result.profileName, "balanced");
  assert.equal(result.trace.routeReason, "sticky_profile");
});

test("model routing fails over away from failed cheap provider conservatively", () => {
  const service = new ModelRoutingService({
    registry: buildRegistry(),
    providerHealth: {
      anthropic: {
        status: "failed",
        successRate: 0.1,
        totalCalls: 20,
        failedCalls: 18,
        fallbackCount: 5,
        latestFailureCodes: ["provider.http_429"],
      },
    },
  });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
  });

  assert.equal(result.profile.provider, "openai");
  assert.equal(result.trace.routeReason, "provider_health_fallback");
});

test("model routing respects explicit pin and fails closed for unavailable profiles", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });

  const pinned = service.route({
    pinnedProfileName: "coding-medium",
  });
  assert.equal(pinned.profileName, "coding-medium");
  assert.equal(pinned.trace.routeReason, "pinned_profile");

  assert.throws(
    () =>
      service.route({
        pinnedProfileName: "missing-profile",
      }),
    /model_route\.profile_unavailable:missing-profile/,
  );
});

test("model routing issues a turn-scoped fallback lease when preferred profile is unavailable for the current turn", () => {
  const service = new ModelRoutingService({
    registry: buildRegistry(),
    providerHealth: {
      anthropic: {
        status: "failed",
        successRate: 0.1,
        totalCalls: 20,
        failedCalls: 18,
        fallbackCount: 5,
        latestFailureCodes: ["provider.http_429"],
      },
    },
  });

  const result = service.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    turnId: "turn-1",
  });

  assert.equal(result.profileName, "reasoning-medium");
  assert.equal(result.trace.routeReason, "provider_health_fallback");
  assert.equal(result.trace.turnScopedFallbackIssued, true);
  assert.equal(result.trace.turnScopedFallbackPrimaryProfileName, "balanced");
  assert.equal(result.trace.turnScopedFallbackProfileName, "reasoning-medium");
  assert.equal(result.fallbackLease?.turnId, "turn-1");
  assert.equal(result.fallbackLease?.primaryProfileName, "balanced");
  assert.equal(result.fallbackLease?.fallbackProfileName, "reasoning-medium");
});

test("model routing reuses a turn-scoped fallback lease only within the same turn and auto-recovers on the next turn", () => {
  const degradedService = new ModelRoutingService({
    registry: buildRegistry(),
    providerHealth: {
      anthropic: {
        status: "failed",
        successRate: 0.1,
        totalCalls: 20,
        failedCalls: 18,
        fallbackCount: 5,
        latestFailureCodes: ["provider.http_429"],
      },
    },
  });

  const initial = degradedService.route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    turnId: "turn-1",
  });

  const sameTurn = new ModelRoutingService({
    registry: buildRegistry(),
    providerHealth: {
      anthropic: {
        status: "healthy",
        successRate: 0.95,
        totalCalls: 25,
        failedCalls: 1,
        fallbackCount: 5,
        latestFailureCodes: [],
      },
    },
  }).route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    turnId: "turn-1",
    fallbackLease: initial.fallbackLease,
  });

  assert.equal(sameTurn.profileName, "reasoning-medium");
  assert.equal(sameTurn.trace.routeReason, "turn_scoped_fallback_lease");
  assert.equal(sameTurn.trace.turnScopedFallbackActive, true);
  assert.equal(sameTurn.trace.turnScopedFallbackAutoRecoveryNextTurn, true);

  const nextTurn = new ModelRoutingService({
    registry: buildRegistry(),
    providerHealth: {
      anthropic: {
        status: "healthy",
        successRate: 0.95,
        totalCalls: 25,
        failedCalls: 1,
        fallbackCount: 5,
        latestFailureCodes: [],
      },
    },
  }).route({
    routeClass: "default",
    riskLevel: "medium",
    preferredProfileName: "balanced",
    turnId: "turn-2",
    fallbackLease: initial.fallbackLease,
  });

  assert.equal(nextTurn.profileName, "balanced");
  assert.equal(nextTurn.trace.routeReason, "preferred_profile");
  assert.equal(nextTurn.trace.turnScopedFallbackActive, false);
  assert.equal(nextTurn.fallbackLease, null);
});

test("model routing rejects malformed turn fallback leases", () => {
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

test("model routing falls back from degraded governance profile to rollback target", () => {
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

  assert.equal(result.profileName, "reasoning-medium");
  assert.equal(result.trace.routeReason, "governance_fallback");
  assert.equal(result.trace.selectedGovernanceStatus, "active");
});

test("model routing fail-closes pinned governance-disabled profiles", () => {
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
