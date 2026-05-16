import assert from "node:assert/strict";
import test from "node:test";

import { ModelGatewayFallbackService, FALLBACK_CHAIN_ORDER, type ModelFallbackCandidate, type ModelFallbackDecision } from "../../../../src/platform/model-gateway/fallback/index.js";

test("ModelGatewayFallbackService selectFallback returns primary when candidates empty", () => {
  const service = new ModelGatewayFallbackService();
  const result = service.selectFallback({
    primaryProfileName: "primary-model",
    candidates: [],
  });

  assert.equal(result.selectedProfileName, null);
  assert.equal(result.reasonCode, "fallback.no_candidate_available");
  assert.deepStrictEqual(result.attemptedProfiles, ["primary-model"]);
  assert.deepStrictEqual(result.fallbackChain, ["primary-model"]);
});

test("ModelGatewayFallbackService selectFallback sorts candidates by tier priority", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "secondary", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "tertiary", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  // Affinity to primary tier (balanced) takes priority over fixed tier order
  assert.equal(result.selectedProfileName, "secondary");
  assert.equal(result.degradedFromProfileName, "primary");
  assert.ok(result.reasonCode.startsWith("fallback.healthy_alternative_selected"));
});

test("ModelGatewayFallbackService selectFallback excludes specified profiles", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "secondary", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "tertiary", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    excludedProfiles: ["secondary"],
  });

  assert.equal(result.selectedProfileName, "tertiary");
});

test("ModelGatewayFallbackService selectFallback excludes unhealthy candidates", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "secondary", provider: "openai", tier: "balanced", healthy: false, inputCostPer1kUsd: 0.5 },
    { profileName: "tertiary", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(result.selectedProfileName, "tertiary");
});

test("ModelGatewayFallbackService selectFallback filters by maxInputCostPer1kUsd", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "expensive", provider: "openai", tier: "reasoning", healthy: true, inputCostPer1kUsd: 5.0 },
    { profileName: "cheap", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    maxInputCostPer1kUsd: 1.0,
  });

  assert.equal(result.selectedProfileName, "cheap");
});

test("ModelGatewayFallbackService selectFallback sorts by fallbackPriority", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "low-priority", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5, fallbackPriority: 10 },
    { profileName: "high-priority", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0, fallbackPriority: 1 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(result.selectedProfileName, "high-priority");
});

test("ModelGatewayFallbackService selectFallback sorts by tier order", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "fast", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.1 },
    { profileName: "reasoning", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "balanced", provider: "minimax", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
    { profileName: "coding", provider: "openai", tier: "coding", healthy: true, inputCostPer1kUsd: 0.2 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  // primary not in candidates, primaryTier is null -> affinity equal for all -> cost wins
  assert.equal(result.selectedProfileName, "fast");
});

test("ModelGatewayFallbackService selectFallback builds correct fallbackChain", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "secondary", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "tertiary", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  // tier order sorts: secondary (balanced, rank 1) before tertiary (reasoning, rank 0)
  // but affinity is equal (primaryTier null) -> cost tie -> costTierOrder: balanced(1) < reasoning(2)
  // Actually secondary (0.5) is cheaper than tertiary (1.0) so secondary wins
  assert.deepStrictEqual(result.fallbackChain, ["primary", "secondary", "tertiary"]);
});

test("FALLBACK_CHAIN_ORDER constant is correct", () => {
  assert.deepStrictEqual(FALLBACK_CHAIN_ORDER, ["primary", "secondary", "tertiary"]);
});

test("ModelGatewayFallbackService selectFallback returns correct attemptedProfiles", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "secondary", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "tertiary", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.deepStrictEqual(result.attemptedProfiles, ["primary", "secondary", "tertiary"]);
});
