import assert from "node:assert/strict";
import test from "node:test";

import { ModelGatewayFallbackService, type ModelFallbackCandidate } from "../../../../../src/platform/model-gateway/fallback/index.js";

test("ModelGatewayFallbackService selects the cheapest healthy fallback", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    maxInputCostPer1kUsd: 0.4,
    candidates: [
      { profileName: "primary", provider: "openai", tier: "reasoning", healthy: false, inputCostPer1kUsd: 1.2 },
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
      { profileName: "fallback-b", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.35 },
    ],
  });

  assert.equal(decision.selectedProfileName, "fallback-a");
  assert.equal(decision.reasonCode, "fallback.healthy_alternative_selected");
});

test("ModelGatewayFallbackService returns no candidate when candidates array is empty", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [],
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
  assert.deepEqual(decision.attemptedProfiles, ["primary"]);
});

test("ModelGatewayFallbackService returns no candidate when primary is the only candidate", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "primary", provider: "openai", tier: "reasoning", healthy: true, inputCostPer1kUsd: 1.2 },
    ],
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
  assert.deepEqual(decision.attemptedProfiles, ["primary"]);
});

test("ModelGatewayFallbackService returns no candidate when all candidates are unhealthy", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "primary", provider: "openai", tier: "reasoning", healthy: false, inputCostPer1kUsd: 1.2 },
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: false, inputCostPer1kUsd: 0.3 },
      { profileName: "fallback-b", provider: "anthropic", tier: "balanced", healthy: false, inputCostPer1kUsd: 0.35 },
    ],
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ModelGatewayFallbackService respects excludedProfiles", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "primary", provider: "openai", tier: "reasoning", healthy: false, inputCostPer1kUsd: 1.2 },
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
      { profileName: "fallback-b", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.35 },
    ],
    excludedProfiles: ["fallback-a"],
  });

  assert.equal(decision.selectedProfileName, "fallback-b");
  assert.equal(decision.reasonCode, "fallback.healthy_alternative_selected");
});

test("ModelGatewayFallbackService excludes all candidates when all are excluded", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
      { profileName: "fallback-b", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.35 },
    ],
    excludedProfiles: ["fallback-a", "fallback-b"],
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ModelGatewayFallbackService respects maxInputCostPer1kUsd filter", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "primary", provider: "openai", tier: "reasoning", healthy: false, inputCostPer1kUsd: 1.2 },
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
      { profileName: "fallback-b", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    ],
    maxInputCostPer1kUsd: 0.4,
  });

  assert.equal(decision.selectedProfileName, "fallback-a");
  assert.equal(decision.reasonCode, "fallback.healthy_alternative_selected");
});

test("ModelGatewayFallbackService returns no candidate when all exceed maxInputCostPer1kUsd", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
      { profileName: "fallback-b", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.6 },
    ],
    maxInputCostPer1kUsd: 0.4,
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ModelGatewayFallbackService attemptedProfiles tracks the selected fallback chain only", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "primary", provider: "openai", tier: "reasoning", healthy: false, inputCostPer1kUsd: 1.2 },
    { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
    { profileName: "fallback-b", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.35 },
  ];
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.deepEqual(decision.attemptedProfiles, ["primary", "fallback-a"]);
  assert.deepEqual(decision.fallbackChain, ["primary", "fallback-a", "fallback-b"]);
});

test("ModelGatewayFallbackService sets degradedFromProfileName to primary", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "my-primary-model",
    candidates: [
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
    ],
  });

  assert.equal(decision.degradedFromProfileName, "my-primary-model");
});

test("ModelGatewayFallbackService selects second cheapest when first is excluded", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.2 },
      { profileName: "fallback-b", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
      { profileName: "fallback-c", provider: "minimax", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.4 },
    ],
    excludedProfiles: ["fallback-a"],
  });

  assert.equal(decision.selectedProfileName, "fallback-b");
});

test("ModelGatewayFallbackService handles undefined excludedProfiles", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
    ],
    // excludedProfiles is undefined
  });

  assert.equal(decision.selectedProfileName, "fallback-a");
});

test("ModelGatewayFallbackService handles null maxInputCostPer1kUsd", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 1.5 },
    ],
    maxInputCostPer1kUsd: null, // no limit
  });

  assert.equal(decision.selectedProfileName, "fallback-a");
});

test("ModelGatewayFallbackService sorts by input cost ascending", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "fallback-c", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
      { profileName: "fallback-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.2 },
      { profileName: "fallback-b", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
    ],
  });

  assert.equal(decision.selectedProfileName, "fallback-a");
});

test("ModelGatewayFallbackService prefers primary-tier-compatible fallback over a cheaper incompatible tier", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "primary", provider: "openai", tier: "balanced", healthy: false, inputCostPer1kUsd: 1.2 },
      { profileName: "fast-cheap", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.2 },
      { profileName: "balanced-safe", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
    ],
  });

  assert.equal(decision.selectedProfileName, "balanced-safe");
  assert.deepEqual(decision.attemptedProfiles, ["primary", "balanced-safe"]);
});

test("ModelGatewayFallbackService reasonCode is no_candidate when nothing eligible", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "primary", provider: "openai", tier: "reasoning", healthy: false, inputCostPer1kUsd: 0.5 },
    ],
    excludedProfiles: ["primary"],
  });

  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});
