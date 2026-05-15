import assert from "node:assert/strict";
import test from "node:test";

import { ModelGatewayFallbackService, type ModelFallbackCandidate } from "../../../../../src/platform/model-gateway/fallback/index.js";

test("ModelGatewayFallbackService.selectFallback returns cheapest healthy candidate", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "gpt-4", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 10 },
    { profileName: "gpt-4o-mini", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.15 },
    { profileName: "claude-3-5", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 3 },
  ];

  const result = service.selectFallback({ primaryProfileName: "gpt-4", candidates });

  assert.equal(result.selectedProfileName, "gpt-4o-mini");
  assert.equal(result.reasonCode, "fallback.healthy_alternative_selected");
  assert.equal(result.degradedFromProfileName, "gpt-4");
  assert.ok(result.attemptedProfiles.includes("gpt-4o-mini"));
});

test("ModelGatewayFallbackService.selectFallback excludes primary profile", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "gpt-4", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 10 },
    { profileName: "gpt-4o", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 5 },
  ];

  const result = service.selectFallback({ primaryProfileName: "gpt-4", candidates });

  assert.notEqual(result.selectedProfileName, "gpt-4");
});

test("ModelGatewayFallbackService.selectFallback excludes unhealthy candidates", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "unhealthy-profile", provider: "openai", tier: "balanced", healthy: false, inputCostPer1kUsd: 1 },
    { profileName: "healthy-cheap", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 2 },
  ];

  const result = service.selectFallback({ primaryProfileName: "primary", candidates });

  assert.equal(result.selectedProfileName, "healthy-cheap");
});

test("ModelGatewayFallbackService.selectFallback respects excludedProfiles", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "candidate-a", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 1 },
    { profileName: "candidate-b", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 2 },
    { profileName: "candidate-c", provider: "anthropic", tier: "fast", healthy: true, inputCostPer1kUsd: 3 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    excludedProfiles: ["candidate-b"],
  });

  assert.equal(result.selectedProfileName, "candidate-a");
});

test("ModelGatewayFallbackService.selectFallback respects maxInputCostPer1kUsd", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "cheap", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 1 },
    { profileName: "medium", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 5 },
    { profileName: "expensive", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 10 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    maxInputCostPer1kUsd: 6,
  });

  assert.equal(result.selectedProfileName, "cheap");
});

test("ModelGatewayFallbackService.selectFallback returns no_candidate when none available", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "unhealthy", provider: "openai", tier: "fast", healthy: false, inputCostPer1kUsd: 1 },
  ];

  const result = service.selectFallback({ primaryProfileName: "primary", candidates });

  assert.equal(result.selectedProfileName, null);
  assert.equal(result.reasonCode, "fallback.no_candidate_available");
});

test("ModelGatewayFallbackService.selectFallback handles empty candidates", () => {
  const service = new ModelGatewayFallbackService();

  const result = service.selectFallback({ primaryProfileName: "primary", candidates: [] });

  assert.equal(result.selectedProfileName, null);
  assert.equal(result.reasonCode, "fallback.no_candidate_available");
  assert.deepEqual(result.attemptedProfiles, []);
});

test("ModelGatewayFallbackService.selectFallback includes all candidates in attemptedProfiles", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "first", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 1 },
    { profileName: "second", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 2 },
  ];

  const result = service.selectFallback({ primaryProfileName: "primary", candidates });

  assert.equal(result.attemptedProfiles.length, 2);
  assert.ok(result.attemptedProfiles.includes("first"));
  assert.ok(result.attemptedProfiles.includes("second"));
});

test("ModelGatewayFallbackService.selectFallback prioritizes by input cost", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "expensive", provider: "openai", tier: "reasoning", healthy: true, inputCostPer1kUsd: 10 },
    { profileName: "cheap", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "medium", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 3 },
  ];

  const result = service.selectFallback({ primaryProfileName: "primary", candidates });

  assert.equal(result.selectedProfileName, "cheap");
});

test("ModelGatewayFallbackService.selectFallback filters by max cost strictly", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "at-limit", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 5 },
    { profileName: "over-limit", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 6 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    maxInputCostPer1kUsd: 5,
  });

  assert.equal(result.selectedProfileName, "at-limit");
});

test("ModelGatewayFallbackService.selectFallback null maxInputCostPer1kUsd allows all", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "cheap", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 1 },
    { profileName: "expensive", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 20 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    maxInputCostPer1kUsd: null,
  });

  assert.equal(result.selectedProfileName, "cheap");
});

test("ModelGatewayFallbackService.selectFallback sets degradedFromProfileName to primary", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "fallback-candidate", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 1 },
  ];

  const result = service.selectFallback({ primaryProfileName: "my-primary", candidates });

  assert.equal(result.degradedFromProfileName, "my-primary");
});

test("ModelGatewayFallbackService.selectFallback uses second cheapest when cheapest is excluded", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "cheapest", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 1 },
    { profileName: "second", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 2 },
    { profileName: "third", provider: "anthropic", tier: "fast", healthy: true, inputCostPer1kUsd: 3 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    excludedProfiles: ["cheapest"],
  });

  assert.equal(result.selectedProfileName, "second");
});

test("ModelGatewayFallbackService.selectFallback handles primary being in candidates list", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "primary", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 5 },
    { profileName: "fallback", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 1 },
  ];

  const result = service.selectFallback({ primaryProfileName: "primary", candidates });

  assert.equal(result.selectedProfileName, "fallback");
  assert.notEqual(result.selectedProfileName, "primary");
});

test("ModelGatewayFallbackService.selectFallback returns correct reason for single candidate", () => {
  const service = new ModelGatewayFallbackService();
  const candidates: ModelFallbackCandidate[] = [
    { profileName: "only-one", provider: "openai", tier: "fast", healthy: true, inputCostPer1kUsd: 1 },
  ];

  const result = service.selectFallback({ primaryProfileName: "primary", candidates });

  assert.equal(result.selectedProfileName, "only-one");
  assert.equal(result.reasonCode, "fallback.healthy_alternative_selected");
});
