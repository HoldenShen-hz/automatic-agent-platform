/**
 * Integration Test: Model Routing Service
 *
 * Verifies model routing integration with route class, risk level,
 * capability filtering, governance, and fallback lease handling.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ModelRoutingService } from "../../../../src/platform/model-gateway/index.js";
import type { ModelMetadataRegistry, ModelProfileMetadata } from "../../../../src/platform/control-plane/config-center/model-metadata-registry.js";
import type { ProviderHealthSummary } from "../../../../src/platform/shared/observability/provider-health-tracker.js";
import type { ModelGovernanceSnapshot } from "../../../../src/platform/prompt-engine/eval/prompt-model-policy-governance-service.js";

// Helper to build a minimal registry for testing
function buildTestRegistry(profiles: Record<string, ModelProfileMetadata>): ModelMetadataRegistry {
  return {
    version: "test",
    providers: {
      openai: { status: "active", authMethods: ["api-key"] },
      anthropic: { status: "active", authMethods: ["api-key"] },
    },
    profiles,
  };
}

function buildHealthSummary(
  status: ProviderHealthSummary["status"],
): ProviderHealthSummary {
  return {
    status,
    successRate: status === "healthy" ? 1 : status === "degraded" ? 0.7 : 0.3,
    totalCalls: status === "healthy" ? 100 : 50,
    failedCalls: status === "healthy" ? 0 : status === "degraded" ? 15 : 35,
    fallbackCount: 0,
    latestFailureCodes: [],
  };
}

test("ModelRouting: routes by route class - coding prefers coding tier", () => {
  const registry = buildTestRegistry({
    "coding-model": {
      provider: "openai",
      modelId: "gpt-5-coder",
      tier: "coding",
      capabilities: ["code", "function_calling"],
      contextWindowTokens: 128000,
      maxOutputTokens: 32000,
      pricing: { inputPer1kUsd: 5.0, outputPer1kUsd: 15.0 },
      metadataSource: "bundled_snapshot",
    },
    "balanced-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
    "fast-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({ routeClass: "coding" });

  assert.equal(decision.profileName, "coding-model");
  assert.equal(decision.trace.routeReason, "coding_required");
  assert.deepEqual(decision.trace.targetTierOrder, ["coding", "reasoning", "balanced", "fast"]);
});

test("ModelRouting: routes by route class - reasoning prefers reasoning tier", () => {
  const registry = buildTestRegistry({
    "reasoning-model": {
      provider: "anthropic",
      modelId: "claude-opus-4",
      tier: "reasoning",
      capabilities: ["reasoning", "analysis"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: { inputPer1kUsd: 15.0, outputPer1kUsd: 75.0 },
      metadataSource: "bundled_snapshot",
    },
    "balanced-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
    "fast-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({ routeClass: "reasoning" });

  assert.equal(decision.profileName, "reasoning-model");
  assert.equal(decision.trace.routeReason, "risk_driven_reasoning");
  assert.deepEqual(decision.trace.targetTierOrder, ["reasoning", "balanced", "coding", "fast"]);
});

test("ModelRouting: routes by route class - classification prefers fast tier", () => {
  const registry = buildTestRegistry({
    "expensive-model": {
      provider: "anthropic",
      modelId: "claude-opus-4",
      tier: "reasoning",
      capabilities: ["reasoning"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: { inputPer1kUsd: 15.0, outputPer1kUsd: 75.0 },
      metadataSource: "bundled_snapshot",
    },
    "fast-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({ routeClass: "classification" });

  assert.equal(decision.profileName, "fast-model");
  assert.equal(decision.trace.routeReason, "classification_cheap_default");
  assert.deepEqual(decision.trace.targetTierOrder, ["fast", "balanced", "reasoning", "coding"]);
});

test("ModelRouting: risk level high prefers reasoning tier", () => {
  const registry = buildTestRegistry({
    "fast-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
    "reasoning-model": {
      provider: "anthropic",
      modelId: "claude-opus-4",
      tier: "reasoning",
      capabilities: ["reasoning", "analysis"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: { inputPer1kUsd: 15.0, outputPer1kUsd: 75.0 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({ riskLevel: "high" });

  assert.equal(decision.profileName, "reasoning-model");
  assert.equal(decision.trace.routeReason, "risk_driven_reasoning");
});

test("ModelRouting: capability filtering excludes profiles without required capability", () => {
  const registry = buildTestRegistry({
    "general-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
    "vision-model": {
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      tier: "balanced",
      capabilities: ["general", "vision", "analysis"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: { inputPer1kUsd: 3.0, outputPer1kUsd: 15.0 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({ requiredCapabilities: ["vision"] });

  assert.equal(decision.profileName, "vision-model");
  assert.ok(decision.trace.filteredOut.includes("general-model:capability_mismatch"));
});

test("ModelRouting: provider health affects routing - degraded provider skipped", () => {
  const registry = buildTestRegistry({
    "model-a": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
    "model-b": {
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: { inputPer1kUsd: 3.0, outputPer1kUsd: 15.0 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({
    registry,
    providerHealth: {
      openai: buildHealthSummary("degraded"),
      anthropic: buildHealthSummary("healthy"),
    },
  });

  const decision = routing.route({ routeClass: "default" });

  // openai is degraded so should route to anthropic
  assert.equal(decision.profileName, "model-b");
  assert.equal(decision.profile.provider, "anthropic");
  assert.equal(decision.trace.healthStatuses.openai, "degraded");
  assert.equal(decision.trace.healthStatuses.anthropic, "healthy");
});

test("ModelRouting: governance snapshot disables profile", () => {
  const registry = buildTestRegistry({
    "normal-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
    "fallback-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const governance: ModelGovernanceSnapshot = {
    profileStatuses: {
      "normal-model": "disabled",
    },
    rollbackTargets: {},
  };

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({
    governanceSnapshot: governance,
    routeClass: "default",
  });

  assert.equal(decision.profileName, "fallback-model");
  assert.ok(decision.trace.filteredOut.includes("normal-model:governance_disabled"));
});

test("ModelRouting: governance snapshot routes to rollback target when degraded", () => {
  const registry = buildTestRegistry({
    "degraded-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 10.0, outputPer1kUsd: 50.0 },
      metadataSource: "bundled_snapshot",
    },
    "rollback-target": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const governance: ModelGovernanceSnapshot = {
    profileStatuses: {
      "degraded-model": "degraded",
      "rollback-target": "active",
    },
    rollbackTargets: {
      "degraded-model": "rollback-target",
    },
  };

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({
    governanceSnapshot: governance,
    routeClass: "default",
  });

  assert.equal(decision.profileName, "rollback-target");
  assert.equal(decision.trace.routeReason, "governance_fallback");
  assert.equal(decision.trace.selectedGovernanceStatus, "active");
  assert.equal(decision.trace.selectedGovernanceRollbackTarget, null);
});

test("ModelRouting: pinned profile throws when unavailable", () => {
  const registry = buildTestRegistry({
    "available-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  assert.throws(
    () => routing.route({ pinnedProfileName: "nonexistent-model" }),
    /model_route.profile_unavailable:nonexistent-model/,
  );
});

test("ModelRouting: pinned profile throws when disabled by governance", () => {
  const registry = buildTestRegistry({
    "disabled-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
  });

  const governance: ModelGovernanceSnapshot = {
    profileStatuses: {
      "disabled-model": "disabled",
    },
    rollbackTargets: {},
  };

  const routing = new ModelRoutingService({ registry });

  assert.throws(
    () => routing.route({ pinnedProfileName: "disabled-model", governanceSnapshot: governance }),
    /model_route.profile_governance_disabled:disabled-model/,
  );
});

test("ModelRouting: sticky profile takes precedence", () => {
  const registry = buildTestRegistry({
    "preferred-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
    "cheaper-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({
    stickyProfileName: "preferred-model",
    routeClass: "classification",
  });

  assert.equal(decision.profileName, "preferred-model");
  assert.equal(decision.trace.routeReason, "sticky_profile");
});

test("ModelRouting: preferred profile takes precedence over route class selection", () => {
  const registry = buildTestRegistry({
    "coding-model": {
      provider: "openai",
      modelId: "gpt-5-coder",
      tier: "coding",
      capabilities: ["code", "function_calling"],
      contextWindowTokens: 128000,
      maxOutputTokens: 32000,
      pricing: { inputPer1kUsd: 5.0, outputPer1kUsd: 15.0 },
      metadataSource: "bundled_snapshot",
    },
    "balanced-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({
    preferredProfileName: "balanced-model",
    routeClass: "coding",
  });

  assert.equal(decision.profileName, "balanced-model");
  assert.equal(decision.trace.routeReason, "preferred_profile");
});

test("ModelRouting: turn-scoped fallback lease is honored", () => {
  const registry = buildTestRegistry({
    "primary-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
    "fallback-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const existingLease = {
    turnId: "turn-123",
    primaryProfileName: "primary-model",
    fallbackProfileName: "fallback-model",
    issuedAt: new Date().toISOString(),
    reason: "provider_health_fallback" as const,
  };

  const decision = routing.route({
    turnId: "turn-123",
    fallbackLease: existingLease,
  });

  assert.equal(decision.profileName, "fallback-model");
  assert.equal(decision.trace.routeReason, "turn_scoped_fallback_lease");
  assert.equal(decision.trace.turnScopedFallbackActive, true);
  assert.equal(decision.trace.turnScopedFallbackIssued, false);
  assert.equal(decision.trace.turnScopedFallbackAutoRecoveryNextTurn, true);
  assert.ok(decision.fallbackLease != null);
  assert.equal(decision.fallbackLease?.primaryProfileName, "primary-model");
});

test("ModelRouting: new fallback lease issued when primary degraded", () => {
  const registry = buildTestRegistry({
    "primary-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 10.0, outputPer1kUsd: 50.0 },
      metadataSource: "bundled_snapshot",
    },
    "fallback-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({
    registry,
    providerHealth: {
      openai: buildHealthSummary("degraded"),
      anthropic: buildHealthSummary("healthy"),
    },
  });

  // Use preferredProfileName instead of sticky to allow provider health fallback to trigger
  const decision = routing.route({
    turnId: "turn-456",
    preferredProfileName: "primary-model",
  });

  assert.equal(decision.profileName, "fallback-model");
  assert.equal(decision.trace.routeReason, "provider_health_fallback");
  assert.ok(decision.fallbackLease != null);
  assert.equal(decision.fallbackLease?.primaryProfileName, "primary-model");
  assert.equal(decision.fallbackLease?.fallbackProfileName, "fallback-model");
  assert.equal(decision.fallbackLease?.reason, "provider_health_fallback");
  assert.equal(decision.fallbackLease?.turnId, "turn-456");
});

test("ModelRouting: max input cost per 1k USD filters candidates", () => {
  const registry = buildTestRegistry({
    "expensive-model": {
      provider: "anthropic",
      modelId: "claude-opus-4",
      tier: "reasoning",
      capabilities: ["reasoning"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: { inputPer1kUsd: 15.0, outputPer1kUsd: 75.0 },
      metadataSource: "bundled_snapshot",
    },
    "cheap-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({
    maxInputPer1kUsd: 1.0,
    routeClass: "classification",
  });

  assert.equal(decision.profileName, "cheap-model");
  assert.equal(decision.trace.routeReason, "cost_cap_fallback");
});

test("ModelRouting: cost filter falls back to higher tier when no cheaper candidates", () => {
  const registry = buildTestRegistry({
    "balanced-model": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
    "reasoning-model": {
      provider: "anthropic",
      modelId: "claude-opus-4",
      tier: "reasoning",
      capabilities: ["reasoning"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: { inputPer1kUsd: 15.0, outputPer1kUsd: 75.0 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  // Set max cost below balanced tier, should still get balanced since no fast tier exists
  const decision = routing.route({
    maxInputPer1kUsd: 1.0,
    routeClass: "classification", // normally prefers fast
  });

  assert.equal(decision.profileName, "balanced-model");
  assert.equal(decision.trace.routeReason, "cost_cap_fallback");
});

test("ModelRouting: allowStrongUpgrade allows fallback to any tier", () => {
  const registry = buildTestRegistry({
    "fast-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  // Request coding which requires coding tier, but only fast tier exists
  // allowStrongUpgrade means we can use any tier when target tier has no candidates
  const decision = routing.route({
    routeClass: "coding",
    allowStrongUpgrade: true,
  });

  // Should fall back to fast-model (only available)
  assert.equal(decision.profileName, "fast-model");
  // routeReason is coding_required since that's the base reason for coding routeClass
  assert.equal(decision.trace.routeReason, "coding_required");
  assert.deepEqual(decision.trace.targetTierOrder, ["coding", "reasoning", "balanced", "fast"]);
});

test("ModelRouting: classification prefers fast tier", () => {
  const registry = buildTestRegistry({
    "model-a": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
    "model-b": {
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: { inputPer1kUsd: 3.0, outputPer1kUsd: 15.0 },
      metadataSource: "bundled_snapshot",
    },
    "model-c": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({
    routeClass: "classification",
  });

  // classification prefers fast tier, which is model-c
  assert.equal(decision.profileName, "model-c");
});

test("ModelRouting: failed provider causes fallback", () => {
  const registry = buildTestRegistry({
    "model-a": {
      provider: "openai",
      modelId: "gpt-5",
      tier: "balanced",
      capabilities: ["general"],
      contextWindowTokens: 128000,
      maxOutputTokens: 16000,
      pricing: { inputPer1kUsd: 2.5, outputPer1kUsd: 10.0 },
      metadataSource: "bundled_snapshot",
    },
    "model-b": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["fast"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({
    registry,
    providerHealth: {
      openai: buildHealthSummary("failed"),
      anthropic: buildHealthSummary("healthy"),
    },
  });

  const decision = routing.route({ routeClass: "default" });

  // openai is failed, should route to anthropic
  assert.equal(decision.profileName, "model-b");
  assert.equal(decision.profile.provider, "anthropic");
  assert.equal(decision.trace.routeReason, "provider_health_fallback");
});

test("ModelRouting: trace records filtered out reasons", () => {
  const registry = buildTestRegistry({
    "vision-model": {
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      tier: "balanced",
      capabilities: ["general", "vision"],
      contextWindowTokens: 200000,
      maxOutputTokens: 8192,
      pricing: { inputPer1kUsd: 3.0, outputPer1kUsd: 15.0 },
      metadataSource: "bundled_snapshot",
    },
    "general-model": {
      provider: "anthropic",
      modelId: "claude-3-haiku",
      tier: "fast",
      capabilities: ["general"],
      contextWindowTokens: 200000,
      maxOutputTokens: 4096,
      pricing: { inputPer1kUsd: 0.25, outputPer1kUsd: 1.25 },
      metadataSource: "bundled_snapshot",
    },
  });

  const routing = new ModelRoutingService({ registry });

  const decision = routing.route({ requiredCapabilities: ["vision"] });

  // Should select vision-model and general-model should be filtered out for capability mismatch
  assert.equal(decision.profileName, "vision-model");
  assert.ok(decision.trace.filteredOut.includes("general-model:capability_mismatch"));
});