import assert from "node:assert/strict";
import test from "node:test";

import { ModelGatewayFallbackService, type ModelFallbackCandidate } from "../../../../src/platform/model-gateway/fallback/index.js";

// Helper to create a fallback candidate with defaults
function createCandidate(overrides: Partial<ModelFallbackCandidate> = {}): ModelFallbackCandidate {
  return {
    profileName: "profile_1",
    provider: "openai",
    tier: "balanced",
    healthy: true,
    inputCostPer1kUsd: 0.5,
    ...overrides,
  };
}

test("selectFallback returns null when no candidates provided", () => {
  const service = new ModelGatewayFallbackService();

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [],
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
  assert.deepEqual(decision.attemptedProfiles, []);
});

test("selectFallback excludes the primary profile", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [
    createCandidate({ profileName: "primary", inputCostPer1kUsd: 0.1 }),
    createCandidate({ profileName: "fallback_1", inputCostPer1kUsd: 0.5 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(decision.selectedProfileName, "fallback_1");
});

test("selectFallback excludes explicitly excluded profiles", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [
    createCandidate({ profileName: "primary", inputCostPer1kUsd: 0.1 }),
    createCandidate({ profileName: "exclude_me", inputCostPer1kUsd: 0.2 }),
    createCandidate({ profileName: "fallback_1", inputCostPer1kUsd: 0.3 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    excludedProfiles: ["exclude_me"],
  });

  assert.equal(decision.selectedProfileName, "fallback_1");
});

test("selectFallback excludes unhealthy candidates", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [
    createCandidate({ profileName: "primary", healthy: false }),
    createCandidate({ profileName: "unhealthy", healthy: false }),
    createCandidate({ profileName: "healthy", healthy: true }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(decision.selectedProfileName, "healthy");
});

test("selectFallback respects maxInputCostPer1kUsd limit", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [
    createCandidate({ profileName: "primary", inputCostPer1kUsd: 0.1 }),
    createCandidate({ profileName: "expensive", inputCostPer1kUsd: 2.0 }),
    createCandidate({ profileName: "affordable", inputCostPer1kUsd: 0.5 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    maxInputCostPer1kUsd: 1.0,
  });

  assert.equal(decision.selectedProfileName, "affordable");
});

test("selectFallback ignores null maxInputCostPer1kUsd (unlimited)", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [
    createCandidate({ profileName: "primary", inputCostPer1kUsd: 0.1 }),
    createCandidate({ profileName: "expensive", inputCostPer1kUsd: 5.0 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    maxInputCostPer1kUsd: null,
  });

  assert.equal(decision.selectedProfileName, "expensive");
});

test("selectFallback selects cheapest eligible candidate", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [
    createCandidate({ profileName: "primary", inputCostPer1kUsd: 0.1 }),
    createCandidate({ profileName: "pricy", inputCostPer1kUsd: 1.5 }),
    createCandidate({ profileName: "cheap", inputCostPer1kUsd: 0.3 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(decision.selectedProfileName, "cheap");
});

test("selectFallback returns null when no eligible candidates", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [
    createCandidate({ profileName: "primary" }),
    createCandidate({ profileName: "unhealthy", healthy: false }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("selectFallback populates attemptedProfiles with all candidate names", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [
    createCandidate({ profileName: "primary" }),
    createCandidate({ profileName: "candidate_1" }),
    createCandidate({ profileName: "candidate_2" }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.deepEqual(decision.attemptedProfiles, ["primary", "candidate_1", "candidate_2"]);
});

test("selectFallback sets degradedFromProfileName to primary", () => {
  const service = new ModelGatewayFallbackService();

  const decision = service.selectFallback({
    primaryProfileName: "my_primary",
    candidates: [createCandidate({ profileName: "fallback" })],
  });

  assert.equal(decision.degradedFromProfileName, "my_primary");
});

test("selectFallback handles all tiers", () => {
  const service = new ModelGatewayFallbackService();
  const tiers: Array<ModelFallbackCandidate["tier"]> = ["fast", "balanced", "reasoning", "coding"];

  for (const tier of tiers) {
    const candidates = [
      createCandidate({ profileName: "primary", tier: "balanced" }),
      createCandidate({ profileName: tier, tier }),
    ];

    const decision = service.selectFallback({
      primaryProfileName: "primary",
      candidates,
    });

    assert.equal(decision.selectedProfileName, tier, `Should select tier: ${tier}`);
  }
});

test("selectFallback handles empty excludedProfiles", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [createCandidate({ profileName: "primary" }), createCandidate({ profileName: "fallback" })];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    excludedProfiles: [],
  });

  assert.equal(decision.selectedProfileName, "fallback");
});
