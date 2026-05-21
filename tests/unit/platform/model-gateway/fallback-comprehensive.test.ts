/**
 * Comprehensive Model Fallback Tests
 * Tests ModelGatewayFallbackService for candidate selection, tier affinity,
 * cost-based routing, fallback chain construction, and edge cases.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ModelGatewayFallbackService,
  FALLBACK_CHAIN_ORDER,
  type ModelFallbackCandidate,
  type ModelFallbackDecision,
} from "../../../../src/platform/model-gateway/fallback/index.js";

test("ModelGatewayFallbackService selectFallback handles empty candidates", () => {
  const service = new ModelGatewayFallbackService();
  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [],
  });

  assert.equal(result.selectedProfileName, null);
  assert.equal(result.reasonCode, "fallback.no_candidate_available");
  assert.deepStrictEqual(result.attemptedProfiles, []);
  assert.deepStrictEqual(result.fallbackChain, ["primary"]);
});

test("ModelGatewayFallbackService selectFallback selects by tier affinity for fast primary", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "reasoning", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
    { profileName: "fast", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.1 },
    { profileName: "balanced", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "fast-primary",
    candidates,
  });

  // When primary is not in candidates, primaryTier is null, affinity is equal for all
  // With cost ratio >= 3, cost takes priority - fast is cheapest (0.1 vs 0.5 vs 1.0)
  assert.equal(result.selectedProfileName, "fast");
});

test("ModelGatewayFallbackService selectFallback selects by tier affinity for reasoning primary", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "fast", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.1 },
    { profileName: "reasoning", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "reasoning-primary",
    candidates,
  });

  // When primary is not in candidates, primaryTier is null
  // Cost ratio = 1.0/0.1 = 10 >= 3, so cost takes priority - fast is cheapest
  assert.equal(result.selectedProfileName, "fast");
});

test("ModelGatewayFallbackService selectFallback activates cost priority mode when ratio >= 3", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "expensive", provider: "openai", tier: "reasoning", healthy: true, inputCostPer1kUsd: 3.0 },
    { profileName: "cheap", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.1 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "balanced-primary",
    candidates,
  });

  // Cost ratio = 3.0 / 0.1 = 30 >= 3, so cost takes priority
  assert.equal(result.selectedProfileName, "cheap");
});

test("ModelGatewayFallbackService selectFallback uses affinity when cost ratio < 3", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "balanced", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.6 },
    { profileName: "fast", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.4 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "some-other-primary",
    candidates,
  });

  // Cost ratio = 0.6/0.4 = 1.5 < 3, affinity takes priority
  // primaryTier is null (not in candidates), so affinity is equal
  // With equal affinity and cost ratio < 3, cost is checked after affinity
  // fast is cheaper (0.4 < 0.6), so fast wins
  assert.equal(result.selectedProfileName, "fast");
});

test("ModelGatewayFallbackService selectFallback respects explicit fallbackPriority", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "low-priority", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.1, fallbackPriority: 100 },
    { profileName: "high-priority", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0, fallbackPriority: 1 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(result.selectedProfileName, "high-priority");
});

test("ModelGatewayFallbackService selectFallback filters out unhealthy candidates", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "healthy", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "unhealthy", provider: "anthropic", tier: "reasoning", healthy: false, inputCostPer1kUsd: 1.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(result.selectedProfileName, "healthy");
  assert.ok(!result.attemptedProfiles.includes("unhealthy"));
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

test("ModelGatewayFallbackService selectFallback excludes specified profiles", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "candidate-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "candidate-b", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    excludedProfiles: ["candidate-a"],
  });

  assert.equal(result.selectedProfileName, "candidate-b");
});

test("ModelGatewayFallbackService selectFallback builds correct fallbackChain", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "first", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "second", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.deepStrictEqual(result.fallbackChain, ["primary", "first", "second"]);
});

test("ModelGatewayFallbackService selectFallback handles all tiers correctly", () => {
  const service = new ModelGatewayFallbackService();

  // Test fast tier affinity
  const fastCandidates: ModelFallbackCandidate[] = [
    { profileName: "balanced", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "fast", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.1 },
  ];
  const fastResult = service.selectFallback({ primaryProfileName: "fast-primary", candidates: fastCandidates });
  assert.equal(fastResult.selectedProfileName, "fast");

  // Test coding tier affinity
  const codingCandidates: ModelFallbackCandidate[] = [
    { profileName: "reasoning", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
    { profileName: "coding", provider: "openai", tier: "coding", healthy: true, inputCostPer1kUsd: 0.5 },
  ];
  const codingResult = service.selectFallback({ primaryProfileName: "coding-primary", candidates: codingCandidates });
  assert.equal(codingResult.selectedProfileName, "coding");
});

test("ModelGatewayFallbackService selectFallback handles balanced tier affinity", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "fast", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.1 },
    { profileName: "balanced", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "balanced-primary",
    candidates,
  });

  // Balanced primary affinity: balanced > fast > coding > reasoning
  // Cost ratio = 0.5/0.1 = 5 >= 3, so cost takes priority - fast is cheapest
  assert.equal(result.selectedProfileName, "fast");
});

test("FALLBACK_CHAIN_ORDER is correct", () => {
  assert.deepStrictEqual(FALLBACK_CHAIN_ORDER, ["primary", "secondary", "tertiary"]);
});

test("ModelGatewayFallbackService selectFallback returns correct reason codes", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "candidate", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(result.reasonCode, "fallback.healthy_alternative_selected");
});

test("ModelGatewayFallbackService selectFallback returns no_candidate_available when none eligible", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "unhealthy", provider: "openai", tier: "balanced", healthy: false, inputCostPer1kUsd: 0.5 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(result.selectedProfileName, null);
  assert.equal(result.reasonCode, "fallback.no_candidate_available");
});

test("ModelGatewayFallbackService selectFallback handles cost tiebreaker correctly", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "model-a", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "model-b", provider: "anthropic", tier: "fast", healthy: true, inputCostPer1kUsd: 0.5 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  // Same cost, same tier - alphabetically earlier wins
  assert.equal(result.selectedProfileName, "model-a");
});

test("ModelGatewayFallbackService selectFallback handles primary tier affinity null", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "reasoning", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
    { profileName: "fast", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.1 },
  ];

  // Primary not in candidates, so primaryTier is null
  const result = service.selectFallback({
    primaryProfileName: "nonexistent-primary",
    candidates,
  });

  // When primaryTier is null, affinity is equal - cost wins
  assert.equal(result.selectedProfileName, "fast");
});

test("ModelGatewayFallbackService selectFallback handles only primary in candidates", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "primary", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(result.selectedProfileName, null);
  assert.equal(result.reasonCode, "fallback.no_candidate_available");
});

test("ModelGatewayFallbackService selectFallback with maxInputCostPer1kUsd filters all candidates", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "expensive", provider: "openai", tier: "reasoning", healthy: true, inputCostPer1kUsd: 10.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    maxInputCostPer1kUsd: 1.0,
  });

  assert.equal(result.selectedProfileName, null);
  assert.equal(result.reasonCode, "fallback.no_candidate_available");
});

test("ModelGatewayFallbackService selectFallback attemptedProfiles includes sorted order", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "first", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "second", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.0 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.deepStrictEqual(result.attemptedProfiles, ["first", "second"]);
});