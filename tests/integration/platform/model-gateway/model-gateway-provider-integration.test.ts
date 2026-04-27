/**
 * Integration Test: Model Gateway with Provider Integration
 *
 * Tests model routing, provider selection, fallback chains, and cost tracking
 * using SQLite-backed storage and mock provider configurations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { ModelRoutingService } from "../../../../src/platform/model-gateway/index.js";
import type { ModelMetadataRegistry, ModelProfileMetadata } from "../../../../src/platform/control-plane/config-center/model-metadata-registry.js";
import type { ProviderHealthSummary } from "../../../../src/platform/shared/observability/provider-health-tracker.js";

function buildTestRegistry(profiles: Record<string, ModelProfileMetadata>): ModelMetadataRegistry {
  return {
    version: "test",
    providers: {
      openai: { status: "active", authMethods: ["api-key"] },
      anthropic: { status: "active", authMethods: ["api-key"] },
      minimax: { status: "active", authMethods: ["api-key"] },
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

test("ModelGateway: routes coding requests to coding tier", () => {
  const ctx = createIntegrationContext("aa-mg-coding-");
  try {
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
    const decision = routing.route({ routeClass: "coding" });

    assert.equal(decision.profileName, "coding-model");
    assert.equal(decision.trace.routeReason, "coding_required");
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: routes reasoning requests to reasoning tier", () => {
  const ctx = createIntegrationContext("aa-mg-reasoning-");
  try {
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
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: routes classification requests to fast tier", () => {
  const ctx = createIntegrationContext("aa-mg-class-");
  try {
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
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: capability filtering excludes mismatched profiles", () => {
  const ctx = createIntegrationContext("aa-mg-cap-");
  try {
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
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: degraded provider triggers fallback routing", () => {
  const ctx = createIntegrationContext("aa-mg-degraded-");
  try {
    const registry = buildTestRegistry({
      "model-a": {
        provider: "openai",
        modelId: "gpt-5",
        tier: "balanced",
        capabilities: ["general"],
        contextWindowTokens: 128000,
        maxOutputTokens: 16000,
        pricing: { inputPer1kUsd: 5.0, outputPer1kUsd: 25.0 },
        metadataSource: "bundled_snapshot",
      },
      "model-b": {
        provider: "anthropic",
        modelId: "claude-sonnet-4",
        tier: "balanced",
        capabilities: ["general"],
        contextWindowTokens: 200000,
        maxOutputTokens: 8192,
        pricing: { inputPer1kUsd: 2.0, outputPer1kUsd: 10.0 },
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

    assert.equal(decision.profileName, "model-b");
    assert.equal(decision.trace.routeReason, "provider_health_fallback");
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: failed provider causes routing to healthy provider", () => {
  const ctx = createIntegrationContext("aa-mg-failed-");
  try {
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

    assert.equal(decision.profileName, "model-b");
    assert.equal(decision.trace.routeReason, "provider_health_fallback");
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: pinned profile throws when unavailable", () => {
  const ctx = createIntegrationContext("aa-mg-pinned-");
  try {
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
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: sticky profile takes precedence", () => {
  const ctx = createIntegrationContext("aa-mg-sticky-");
  try {
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
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: turn-scoped fallback lease is honored", () => {
  const ctx = createIntegrationContext("aa-mg-lease-");
  try {
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
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: max input cost filters candidates", () => {
  const ctx = createIntegrationContext("aa-mg-cost-");
  try {
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
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: cost cap fallback triggers when no cheap candidates", () => {
  const ctx = createIntegrationContext("aa-mg-cost-fallback-");
  try {
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
    });

    const routing = new ModelRoutingService({ registry });
    const decision = routing.route({
      maxInputPer1kUsd: 1.0,
      routeClass: "classification",
    });

    assert.equal(decision.profileName, "balanced-model");
    assert.equal(decision.trace.routeReason, "cost_cap_fallback");
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: allowStrongUpgrade enables fallback to any tier", () => {
  const ctx = createIntegrationContext("aa-mg-upgrade-");
  try {
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
    const decision = routing.route({
      routeClass: "coding",
      allowStrongUpgrade: true,
    });

    assert.equal(decision.profileName, "fast-model");
    assert.equal(decision.trace.routeReason, "coding_required");
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: risk level high prefers reasoning tier", () => {
  const ctx = createIntegrationContext("aa-mg-risk-");
  try {
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
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: trace records all filtered out reasons", () => {
  const ctx = createIntegrationContext("aa-mg-filtered-");
  try {
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

    assert.equal(decision.profileName, "vision-model");
    assert.ok(decision.trace.filteredOut.includes("general-model:capability_mismatch"));
  } finally {
    ctx.cleanup();
  }
});

test("ModelGateway: governance disabled profile is excluded", () => {
  const ctx = createIntegrationContext("aa-mg-governance-");
  try {
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

    const governance = {
      profileStatuses: {
        "normal-model": "disabled" as const,
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
  } finally {
    ctx.cleanup();
  }
});
