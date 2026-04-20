import assert from "node:assert/strict";
import test from "node:test";

import type {
  ModelRouteClass,
  ModelRouteRiskLevel,
  ModelRouteRequest,
  ModelRouteFallbackLease,
  ModelRouteTrace,
  ModelRouteDecision,
  ModelRoutingServiceOptions,
} from "../../../../../src/platform/model-gateway/provider-registry/model-routing-service.js";

test("ModelRouteClass accepts all valid values", () => {
  const classes: ModelRouteClass[] = ["default", "classification", "writing", "coding", "reasoning"];
  assert.equal(classes.length, 5);
});

test("ModelRouteRiskLevel accepts all valid values", () => {
  const levels: ModelRouteRiskLevel[] = ["low", "medium", "high", "critical"];
  assert.equal(levels.length, 4);
});

test("ModelRouteRequest structure is correct", () => {
  const request: ModelRouteRequest = {
    routeClass: "coding",
    riskLevel: "medium",
    requiredCapabilities: ["function_calling"],
    preferredProfileName: "claude-3-5-sonnet",
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: "turn_123",
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: 1.5,
    allowStrongUpgrade: true,
  };
  assert.equal(request.routeClass, "coding");
  assert.equal(request.riskLevel, "medium");
  assert.deepEqual(request.requiredCapabilities, ["function_calling"]);
});

test("ModelRouteRequest allows minimal definition", () => {
  const request: ModelRouteRequest = {};
  assert.equal(request.routeClass, undefined);
  assert.equal(request.riskLevel, undefined);
  assert.equal(request.preferredProfileName, undefined);
});

test("ModelRouteRequest allows null optional fields", () => {
  const request: ModelRouteRequest = {
    routeClass: "reasoning",
    riskLevel: "high",
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    fallbackLease: null,
    governanceSnapshot: null,
    maxInputPer1kUsd: null,
    allowStrongUpgrade: false,
  };
  assert.equal(request.preferredProfileName, null);
  assert.equal(request.turnId, null);
});

test("ModelRouteFallbackLease structure is correct", () => {
  const lease: ModelRouteFallbackLease = {
    turnId: "turn_abc",
    primaryProfileName: "claude-3-5-sonnet",
    fallbackProfileName: "claude-4-sonnet",
    issuedAt: "2026-04-14T00:00:00.000Z",
    reason: "provider_health_fallback",
  };
  assert.equal(lease.turnId, "turn_abc");
  assert.equal(lease.reason, "provider_health_fallback");
});

test("ModelRouteFallbackLease reason accepts all valid values", () => {
  const reasons: ModelRouteFallbackLease["reason"][] = [
    "provider_health_fallback",
    "cost_cap_fallback",
    "tier_fallback",
  ];
  assert.equal(reasons.length, 3);
});

test("ModelRouteTrace structure is correct", () => {
  const trace: ModelRouteTrace = {
    routeReason: "preferred_profile",
    requestedRouteClass: "coding",
    requestedRiskLevel: "low",
    requiredCapabilities: ["vision"],
    targetTierOrder: ["coding", "reasoning", "balanced", "fast"],
    selectedProfileName: "claude-3-5-sonnet",
    selectedProvider: "anthropic",
    preferredProfileName: "claude-3-5-sonnet",
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: "turn_456",
    turnScopedFallbackPrimaryProfileName: null,
    turnScopedFallbackProfileName: null,
    turnScopedFallbackActive: false,
    turnScopedFallbackIssued: false,
    turnScopedFallbackAutoRecoveryNextTurn: false,
    selectedGovernanceStatus: "active",
    selectedGovernanceRollbackTarget: null,
    healthStatuses: { anthropic: "healthy", openai: "healthy" },
    filteredOut: [],
  };
  assert.equal(trace.routeReason, "preferred_profile");
  assert.equal(trace.selectedProfileName, "claude-3-5-sonnet");
  assert.deepEqual(trace.healthStatuses, { anthropic: "healthy", openai: "healthy" });
});

test("ModelRouteTrace routeReason accepts all valid values", () => {
  const reasons: ModelRouteTrace["routeReason"][] = [
    "pinned_profile",
    "sticky_profile",
    "preferred_profile",
    "risk_driven_reasoning",
    "coding_required",
    "classification_cheap_default",
    "writing_balanced_default",
    "default_balanced",
    "capability_driven_selection",
    "cost_cap_fallback",
    "provider_health_fallback",
    "tier_fallback",
    "governance_fallback",
    "turn_scoped_fallback_lease",
  ];
  assert.equal(reasons.length, 14);
});

test("ModelRouteTrace allows governance fallback status", () => {
  const trace: ModelRouteTrace = {
    routeReason: "governance_fallback",
    requestedRouteClass: "default",
    requestedRiskLevel: "medium",
    requiredCapabilities: [],
    targetTierOrder: ["balanced"],
    selectedProfileName: "claude-3-haiku",
    selectedProvider: "anthropic",
    preferredProfileName: null,
    pinnedProfileName: null,
    stickyProfileName: null,
    turnId: null,
    turnScopedFallbackPrimaryProfileName: "claude-3-5-sonnet",
    turnScopedFallbackProfileName: "claude-3-haiku",
    turnScopedFallbackActive: true,
    turnScopedFallbackIssued: true,
    turnScopedFallbackAutoRecoveryNextTurn: true,
    selectedGovernanceStatus: "degraded",
    selectedGovernanceRollbackTarget: "claude-3-5-sonnet-v2",
    healthStatuses: {},
    filteredOut: ["claude-3-5-sonnet (disabled by governance)"],
  };
  assert.equal(trace.selectedGovernanceStatus, "degraded");
  assert.equal(trace.selectedGovernanceRollbackTarget, "claude-3-5-sonnet-v2");
});

test("ModelRouteDecision structure is correct", () => {
  const decision: ModelRouteDecision = {
    profileName: "claude-3-5-sonnet",
    profile: {
      provider: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      tier: "balanced",
      capabilities: ["text", "vision"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: {
        inputPer1kUsd: 0.003,
        outputPer1kUsd: 0.015,
      },
      metadataSource: "bundled_snapshot",
    },
    trace: {
      routeReason: "default_balanced",
      requestedRouteClass: "default",
      requestedRiskLevel: "medium",
      requiredCapabilities: [],
      targetTierOrder: ["balanced", "fast", "reasoning", "coding"],
      selectedProfileName: "claude-3-5-sonnet",
      selectedProvider: "anthropic",
      preferredProfileName: null,
      pinnedProfileName: null,
      stickyProfileName: null,
      turnId: null,
      turnScopedFallbackPrimaryProfileName: null,
      turnScopedFallbackProfileName: null,
      turnScopedFallbackActive: false,
      turnScopedFallbackIssued: false,
      turnScopedFallbackAutoRecoveryNextTurn: false,
      selectedGovernanceStatus: "active",
      selectedGovernanceRollbackTarget: null,
      healthStatuses: {},
      filteredOut: [],
    },
    fallbackLease: null,
  };
  assert.equal(decision.profileName, "claude-3-5-sonnet");
  assert.equal(decision.trace.routeReason, "default_balanced");
});

test("ModelRouteDecision allows with fallback lease", () => {
  const lease: ModelRouteFallbackLease = {
    turnId: "turn_fallback",
    primaryProfileName: "claude-3-5-sonnet",
    fallbackProfileName: "claude-4-sonnet",
    issuedAt: "2026-04-14T00:00:00.000Z",
    reason: "cost_cap_fallback",
  };
  const decision: ModelRouteDecision = {
    profileName: "claude-4-sonnet",
    profile: {
      provider: "anthropic",
      modelId: "claude-4-sonnet-20241120",
      tier: "reasoning",
      capabilities: ["text", "vision", "function_calling"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: {
        inputPer1kUsd: 0.015,
        outputPer1kUsd: 0.075,
      },
      metadataSource: "bundled_snapshot",
    },
    trace: {
      routeReason: "cost_cap_fallback",
      requestedRouteClass: "reasoning",
      requestedRiskLevel: "critical",
      requiredCapabilities: [],
      targetTierOrder: ["reasoning"],
      selectedProfileName: "claude-4-sonnet",
      selectedProvider: "anthropic",
      preferredProfileName: null,
      pinnedProfileName: null,
      stickyProfileName: null,
      turnId: "turn_fallback",
      turnScopedFallbackPrimaryProfileName: "claude-3-5-sonnet",
      turnScopedFallbackProfileName: "claude-4-sonnet",
      turnScopedFallbackActive: true,
      turnScopedFallbackIssued: true,
      turnScopedFallbackAutoRecoveryNextTurn: false,
      selectedGovernanceStatus: "active",
      selectedGovernanceRollbackTarget: null,
      healthStatuses: { anthropic: "degraded" },
      filteredOut: [],
    },
    fallbackLease: lease,
  };
  assert.equal(decision.fallbackLease!.reason, "cost_cap_fallback");
});

test("ModelRoutingServiceOptions structure is correct", () => {
  const options: ModelRoutingServiceOptions = {
    registry: {
      version: "1.0.0",
      providers: {},
      profiles: {},
    },
    providerHealth: {
      anthropic: {
        status: "degraded",
        successRate: 0.95,
        totalCalls: 100,
        failedCalls: 5,
        fallbackCount: 2,
        latestFailureCodes: ["rate_limit"],
      },
    },
  };
  const anthropicHealth = options.providerHealth?.["anthropic"];
  assert.equal(anthropicHealth?.status, "degraded");
});
