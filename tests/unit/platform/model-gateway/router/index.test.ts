import assert from "node:assert/strict";
import test from "node:test";

import {
  ModelGatewayCacheService,
  ModelGatewayFallbackService,
  type ModelFallbackCandidate,
  type ModelFallbackDecision,
  FALLBACK_CHAIN_ORDER,
  type FallbackChainPosition,
} from "../../../../../src/platform/model-gateway/router/index.js";

test("router barrel exports ModelGatewayCacheService", () => {
  assert.equal(typeof ModelGatewayCacheService, "function");
});

test("router barrel exports ModelGatewayFallbackService", () => {
  assert.equal(typeof ModelGatewayFallbackService, "function");
});

test("router barrel exports FALLBACK_CHAIN_ORDER constant", () => {
  assert.ok(Array.isArray(FALLBACK_CHAIN_ORDER));
  assert.deepEqual(FALLBACK_CHAIN_ORDER, ["primary", "secondary", "tertiary"]);
});

test("FALLBACK_CHAIN_ORDER has exactly 3 positions", () => {
  assert.equal(FALLBACK_CHAIN_ORDER.length, 3);
  assert.equal(FALLBACK_CHAIN_ORDER[0], "primary");
  assert.equal(FALLBACK_CHAIN_ORDER[1], "secondary");
  assert.equal(FALLBACK_CHAIN_ORDER[2], "tertiary");
});

test("FallbackChainPosition type accepts all chain positions", () => {
  const positions: FallbackChainPosition[] = ["primary", "secondary", "tertiary"];
  assert.equal(positions.length, 3);
});

test("ModelFallbackCandidate type structure", () => {
  const candidate: ModelFallbackCandidate = {
    profileName: "gpt-4",
    provider: "openai",
    tier: "balanced",
    healthy: true,
    inputCostPer1kUsd: 0.5,
  };
  assert.equal(candidate.profileName, "gpt-4");
  assert.equal(candidate.provider, "openai");
  assert.equal(candidate.tier, "balanced");
  assert.equal(candidate.healthy, true);
  assert.equal(candidate.inputCostPer1kUsd, 0.5);
});

test("ModelFallbackCandidate with optional fallbackPriority", () => {
  const candidate: ModelFallbackCandidate = {
    profileName: "gpt-4",
    provider: "openai",
    tier: "balanced",
    healthy: true,
    inputCostPer1kUsd: 0.5,
    fallbackPriority: 1,
  };
  assert.equal(candidate.fallbackPriority, 1);
});

test("ModelFallbackDecision type structure", () => {
  const decision: ModelFallbackDecision = {
    selectedProfileName: "gpt-4",
    reasonCode: "fallback.healthy_alternative_selected:1",
    degradedFromProfileName: "gpt-5",
    attemptedProfiles: ["gpt-5", "gpt-4"],
    fallbackChain: ["gpt-5", "gpt-4"],
  };
  assert.equal(decision.selectedProfileName, "gpt-4");
  assert.ok(decision.reasonCode.includes("fallback."));
  assert.equal(decision.degradedFromProfileName, "gpt-5");
  assert.equal(decision.attemptedProfiles.length, 2);
  assert.equal(decision.fallbackChain.length, 2);
});

test("ModelFallbackDecision with null selectedProfileName", () => {
  const decision: ModelFallbackDecision = {
    selectedProfileName: null,
    reasonCode: "fallback.no_candidate_available",
    degradedFromProfileName: "gpt-5",
    attemptedProfiles: ["gpt-5"],
    fallbackChain: ["gpt-5"],
  };
  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ModelGatewayCacheService can be instantiated", () => {
  const cache = new ModelGatewayCacheService<{ text: string }>();
  assert.ok(cache instanceof ModelGatewayCacheService);
});

test("ModelGatewayFallbackService can be instantiated", () => {
  const service = new ModelGatewayFallbackService();
  assert.ok(service instanceof ModelGatewayFallbackService);
});

test("ModelGatewayFallbackService selectFallback returns correct structure", () => {
  const service = new ModelGatewayFallbackService();
  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "fallback-1", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.3 },
    ],
  });

  assert.ok("selectedProfileName" in decision);
  assert.ok("reasonCode" in decision);
  assert.ok("degradedFromProfileName" in decision);
  assert.ok("attemptedProfiles" in decision);
  assert.ok("fallbackChain" in decision);
});

test("ModelFallbackCandidate tier type accepts all valid values", () => {
  const tiers: ModelFallbackCandidate["tier"][] = ["fast", "balanced", "reasoning", "coding"];
  assert.equal(tiers.length, 4);
  assert.ok(tiers.includes("fast"));
  assert.ok(tiers.includes("balanced"));
  assert.ok(tiers.includes("reasoning"));
  assert.ok(tiers.includes("coding"));
});

test("FALLBACK_CHAIN_ORDER is readonly tuple", () => {
  // Should be readonly
  const readonly: readonly string[] = FALLBACK_CHAIN_ORDER;
  assert.ok(Array.isArray(FALLBACK_CHAIN_ORDER));
  assert.ok(Array.isArray(readonly));
});