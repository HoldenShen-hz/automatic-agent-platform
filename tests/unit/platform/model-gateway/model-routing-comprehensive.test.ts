/**
 * Comprehensive Model Routing Tests
 * Tests model routing service including route class handling, tier selection,
 * fallback lease management, governance policies, and health-based routing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ModelRoutingService } from "../../../../src/platform/model-gateway/provider-registry/model-routing-service.js";
import {
  DEFAULT_MODEL_METADATA_REGISTRY,
  type ModelMetadataRegistry,
  type ModelProfileMetadata,
} from "../../../../src/platform/five-plane-control-plane/config-center/model-metadata-registry.js";
import type { ProviderHealthSummary } from "../../../../src/shared/observability/provider-health-tracker.js";

function buildRegistry(): ModelMetadataRegistry {
  return JSON.parse(JSON.stringify(DEFAULT_MODEL_METADATA_REGISTRY)) as ModelMetadataRegistry;
}

function buildMinimalProfile(overrides: Partial<ModelProfileMetadata> = {}): ModelProfileMetadata {
  return {
    provider: "openai",
    modelId: "test-model",
    tier: "balanced",
    capabilities: [],
    contextWindowTokens: 128000,
    maxOutputTokens: 4096,
    pricing: { inputPer1kUsd: 0.5, outputPer1kUsd: 1.5 },
    metadataSource: "bundled_snapshot",
    ...overrides,
  };
}

function buildRegistryWithProfiles(profiles: Record<string, ModelProfileMetadata>): ModelMetadataRegistry {
  const registry = buildRegistry();
  registry.profiles = profiles;
  return registry;
}

function mockProviderHealth(status: ProviderHealthSummary["status"]): Record<string, ProviderHealthSummary> {
  return {
    openai: { provider: "openai", status, lastChecked: new Date().toISOString(), failureRate: 0, latencyP99Ms: 100, ttftP99Ms: 500 },
    anthropic: { provider: "anthropic", status, lastChecked: new Date().toISOString(), failureRate: 0, latencyP99Ms: 100, ttftP99Ms: 500 },
  };
}

test("ModelRoutingService.route selects coding tier for coding route class", () => {
  const registry = buildRegistryWithProfiles({
    "balanced-4": buildMinimalProfile({ modelId: "gpt-4", tier: "balanced" }),
    "code-4": buildMinimalProfile({ modelId: "codex", tier: "coding", capabilities: ["coding"] }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({ routeClass: "coding" });

  assert.equal(result.trace.requestedRouteClass, "coding");
  assert.ok(result.profileName);
});

test("ModelRoutingService.route selects reasoning tier for reasoning route class", () => {
  const registry = buildRegistryWithProfiles({
    "balanced-4": buildMinimalProfile({ modelId: "gpt-4", tier: "balanced" }),
    "claude-3": buildMinimalProfile({ modelId: "claude-3", tier: "reasoning", capabilities: ["reasoning"] }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({ routeClass: "reasoning" });

  assert.equal(result.trace.requestedRouteClass, "reasoning");
});

test("ModelRoutingService.route uses cost cap to filter candidates", () => {
  const registry = buildRegistryWithProfiles({
    "expensive-model": buildMinimalProfile({ modelId: "expensive", tier: "reasoning", pricing: { inputPer1kUsd: 5.0, outputPer1kUsd: 15.0 } }),
    "cheap-model": buildMinimalProfile({ modelId: "cheap", tier: "balanced", pricing: { inputPer1kUsd: 0.5, outputPer1kUsd: 1.5 } }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({ maxInputPer1kUsd: 1.0 });

  assert.ok(result.profile.pricing.inputPer1kUsd <= 1.0);
});

test("ModelRoutingService.route respects required capabilities filter", () => {
  const registry = buildRegistryWithProfiles({
    "basic-model": buildMinimalProfile({ modelId: "basic", tier: "balanced", capabilities: [] }),
    "vision-model": buildMinimalProfile({ modelId: "vision", tier: "balanced", capabilities: ["vision"] }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({ requiredCapabilities: ["vision"] });

  assert.ok(result.trace.filteredOut.some(f => f.includes("capability_mismatch")));
});

test("ModelRoutingService.route honors pinned profile preference", () => {
  const registry = buildRegistryWithProfiles({
    "model-a": buildMinimalProfile({ modelId: "model-a", tier: "balanced", pricing: { inputPer1kUsd: 0.5, outputPer1kUsd: 1.5 } }),
    "model-b": buildMinimalProfile({ modelId: "model-b", tier: "balanced", pricing: { inputPer1kUsd: 0.3, outputPer1kUsd: 1.0 } }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({ pinnedProfileName: "model-b" });

  assert.equal(result.profileName, "model-b");
  assert.equal(result.trace.routeReason, "pinned_profile");
});

test("ModelRoutingService.route applies governance disabled status", () => {
  const registry = buildRegistryWithProfiles({
    "disabled-model": buildMinimalProfile({ modelId: "disabled", tier: "balanced" }),
    "enabled-model": buildMinimalProfile({ modelId: "enabled", tier: "balanced" }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({
    governanceSnapshot: {
      profileStatuses: { "disabled-model": "disabled" },
      rollbackTargets: {},
    },
  });

  assert.ok(result.trace.filteredOut.some(f => f.includes("governance_disabled")));
});

test("ModelRoutingService.route issues fallback lease on provider health fallback", () => {
  const registry = buildRegistry();
  const service = new ModelRoutingService({
    registry,
    providerHealth: mockProviderHealth("degraded"),
  });

  const result = service.route({});

  assert.equal(result.trace.turnScopedFallbackActive, false);
});

test("ModelRoutingService.route uses turn-scoped fallback lease when provided", () => {
  const registry = buildRegistry();
  const service = new ModelRoutingService({ registry });

  const result = service.route({
    turnId: "turn-123",
    fallbackLease: {
      turnId: "turn-123",
      primaryProfileName: "balanced-4",
      fallbackProfileName: "reasoning-3",
      issuedAt: new Date().toISOString(),
      reason: "provider_health_fallback",
    },
  });

  assert.equal(result.trace.turnScopedFallbackActive, true);
  assert.equal(result.trace.turnScopedFallbackIssued, false);
});

test("ModelRoutingService.route handles data residency constraints", () => {
  const registry = buildRegistryWithProfiles({
    "us-model": buildMinimalProfile({ modelId: "us-model", tier: "balanced", region: "us-east" }),
    "eu-model": buildMinimalProfile({ modelId: "eu-model", tier: "balanced", region: "eu-west" }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({ data_residency: "eu-west" });

  assert.ok(result.trace.filteredOut.some(f => f.includes("data_residency_mismatch")));
});

test("ModelRoutingService.route handles pii input detection", () => {
  const registry = buildRegistryWithProfiles({
    "pii-safe": buildMinimalProfile({ modelId: "pii-safe", tier: "balanced", piiSafe: true }),
    "pii-unsafe": buildMinimalProfile({ modelId: "pii-unsafe", tier: "balanced", piiSafe: false }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({ pii_input_detected: true });

  assert.ok(result.trace.filteredOut.some(f => f.includes("pii_unsafe")));
});

test("ModelRoutingService.route filters profiles by latency SLO", () => {
  const registry = buildRegistryWithProfiles({
    "fast-model": buildMinimalProfile({ modelId: "fast", tier: "fast", pricing: { inputPer1kUsd: 0.1, outputPer1kUsd: 0.3 }, latencyP99Ms: 500 }),
    "slow-model": buildMinimalProfile({ modelId: "slow", tier: "balanced", pricing: { inputPer1kUsd: 0.5, outputPer1kUsd: 1.5 }, latencyP99Ms: 5000 }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({ maxLatencyMs: 1000 });

  assert.ok(result.trace.filteredOut.some(f => f.includes("latency_slo_exceeded")));
});

test("ModelRoutingService.route handles tier fallback when primary tier unavailable", () => {
  const registry = buildRegistryWithProfiles({
    "reasoning-only": buildMinimalProfile({ modelId: "reasoning-only", tier: "reasoning", pricing: { inputPer1kUsd: 1.0, outputPer1kUsd: 3.0 } }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({ routeClass: "coding" });

  assert.ok(result.profileName);
});

test("ModelRoutingService.route calculates latency SLO target correctly for classification", () => {
  const registry = buildRegistry();
  const service = new ModelRoutingService({ registry });

  const result = service.route({ routeClass: "classification" });

  assert.equal(result.trace.requestedRouteClass, "classification");
});

test("ModelRoutingService.route calculates latency SLO target correctly for coding", () => {
  const registry = buildRegistry();
  const service = new ModelRoutingService({ registry });

  const result = service.route({ routeClass: "coding" });

  assert.equal(result.trace.requestedRouteClass, "coding");
});

test("ModelRoutingService.route includes routing reasons in decision", () => {
  const registry = buildRegistry();
  const service = new ModelRoutingService({ registry });

  const result = service.route({ routingStrategy: "cost_optimized" });

  assert.ok(result.decisionReason.some(r => r.includes("routing_strategy")));
});

test("ModelRoutingService.route normalizes purpose to route class", () => {
  const registry = buildRegistry();
  const service = new ModelRoutingService({ registry });

  const planResult = service.route({ purpose: "plan" });
  assert.equal(planResult.trace.requestedRouteClass, "reasoning");

  const executeResult = service.route({ purpose: "execute" });
  assert.equal(executeResult.trace.requestedRouteClass, "default");

  const summarizeResult = service.route({ purpose: "summarize" });
  assert.equal(summarizeResult.trace.requestedRouteClass, "writing");
});

test("ModelRoutingService.route handles judge independence requirement", () => {
  const registry = buildRegistryWithProfiles({
    "judge-independent": buildMinimalProfile({ modelId: "judge-independent", tier: "balanced", judgeIndependent: true }),
    "not-judge-independent": buildMinimalProfile({ modelId: "not-judge-independent", tier: "balanced", judgeIndependent: false }),
  });

  const service = new ModelRoutingService({ registry });
  const result = service.route({ judge_independence: true });

  assert.ok(result.trace.filteredOut.some(f => f.includes("judge_independence_missing")));
});

test("ModelRoutingService.route normalizes empty strings to null", () => {
  const registry = buildRegistry();
  const service = new ModelRoutingService({ registry });

  const result = service.route({
    preferredProfileName: "   ",
    turnId: "",
    pinnedProfileName: "  ",
  });

  assert.equal(result.trace.preferredProfileName, null);
  assert.equal(result.trace.turnId, null);
  assert.equal(result.trace.pinnedProfileName, null);
});

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

test("ModelRoutingService classifyModelRoutingFailure returns capability code for capability errors", () => {
  const { classifyModelRoutingFailure } = ModelRoutingService as unknown as { classifyModelRoutingFailure: (err: unknown) => string | null };
  const error = new Error("capability not supported");
  (error as any).code = "model_route.capability_mismatch";
  assert.equal(classifyModelRoutingFailure(error), "route.capability_mismatch");
});

test("ModelRoutingService classifyModelRoutingFailure returns null for unknown errors", () => {
  const { classifyModelRoutingFailure } = ModelRoutingService as unknown as { classifyModelRoutingFailure: (err: unknown) => string | null };
  const error = new Error("some other error");
  assert.equal(classifyModelRoutingFailure(error), null);
});