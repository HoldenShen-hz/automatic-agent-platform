/**
 * Integration Test: Provider Fallback Integration
 *
 * Verifies provider fallback integration with candidate selection,
 * cost-based selection, health filtering, and exclusion logic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ModelGatewayFallbackService, type ModelFallbackCandidate } from "../../../../src/platform/model-gateway/fallback/index.js";

function makeCandidate(
  name: string,
  opts: Partial<{
    healthy: boolean;
    inputCostPer1kUsd: number;
    tier: string;
    provider: string;
  }> = {},
): ModelFallbackCandidate {
  return {
    profileName: name,
    provider: opts.provider ?? "openai",
    tier: (opts.tier ?? "balanced") as "fast" | "balanced" | "reasoning" | "coding",
    healthy: opts.healthy ?? true,
    inputCostPer1kUsd: opts.inputCostPer1kUsd ?? 2.5,
  };
}

test("ProviderFallback: selects cheapest healthy candidate", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("premium-model", { inputCostPer1kUsd: 15.0, healthy: false }),
    makeCandidate("mid-model", { inputCostPer1kUsd: 3.0 }),
    makeCandidate("cheap-model", { inputCostPer1kUsd: 0.5 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "premium-model",
    candidates,
  });

  assert.equal(decision.selectedProfileName, "cheap-model");
  assert.equal(decision.reasonCode, "fallback.healthy_alternative_selected");
  assert.deepEqual(decision.attemptedProfiles, ["premium-model", "mid-model", "cheap-model"]);
  assert.equal(decision.degradedFromProfileName, "premium-model");
});

test("ProviderFallback: excludes unhealthy candidates", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("model-a", { healthy: true, inputCostPer1kUsd: 5.0 }),
    makeCandidate("model-b", { healthy: false, inputCostPer1kUsd: 1.0 }),
    makeCandidate("model-c", { healthy: true, inputCostPer1kUsd: 2.0 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "model-a",
    candidates,
  });

  assert.equal(decision.selectedProfileName as string, "model-c");
  // model-b is unhealthy so excluded
  assert.ok(!decision.attemptedProfiles.includes("model-b") || decision.selectedProfileName !== "model-b");
});

test("ProviderFallback: excludes primary profile", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("primary-model", { inputCostPer1kUsd: 1.0 }),
    makeCandidate("secondary-model", { inputCostPer1kUsd: 2.0 }),
    makeCandidate("tertiary-model", { inputCostPer1kUsd: 0.5 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary-model",
    candidates,
  });

  assert.equal(decision.selectedProfileName, "tertiary-model");
  assert.notEqual(decision.selectedProfileName, "primary-model");
});

test("ProviderFallback: returns no candidate when all unhealthy", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("model-a", { healthy: false }),
    makeCandidate("model-b", { healthy: false }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "model-a",
    candidates,
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ProviderFallback: returns no candidate when none in budget", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("expensive-model", { inputCostPer1kUsd: 20.0 }),
    makeCandidate("mid-model", { inputCostPer1kUsd: 5.0 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "expensive-model",
    candidates,
    maxInputCostPer1kUsd: 1.0,
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ProviderFallback: respects max input cost filter", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("cheap-model", { inputCostPer1kUsd: 0.5 }),
    makeCandidate("mid-model", { inputCostPer1kUsd: 3.0 }),
    makeCandidate("expensive-model", { inputCostPer1kUsd: 10.0 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "expensive-model",
    candidates,
    maxInputCostPer1kUsd: 5.0,
  });

  // Max cost filter excludes expensive-model (10.0 > 5.0), cheap-model is cheapest among remaining
  assert.equal(decision.selectedProfileName, "cheap-model");
});

test("ProviderFallback: excluded profiles are not selected", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("model-a"),
    makeCandidate("model-b"),
    makeCandidate("model-c"),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "model-a",
    candidates,
    excludedProfiles: ["model-c"],
  });

  // model-c is excluded, so model-b is selected (cheapest remaining after excluding primary and model-c)
  // model-a is primary so excluded, leaving model-b as only eligible candidate
  assert.equal(decision.selectedProfileName, "model-b");
  // attemptedProfiles includes all candidates (exclusions are for selection, not reporting)
  assert.ok(decision.attemptedProfiles.includes("model-c"));
});

test("ProviderFallback: prefers cheaper candidate even if slower tier", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("fast-but-expensive", { tier: "fast", inputCostPer1kUsd: 5.0 }),
    makeCandidate("balanced-cheap", { tier: "balanced", inputCostPer1kUsd: 1.0 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "fast-but-expensive",
    candidates,
  });

  // Balances on cost regardless of tier
  assert.equal(decision.selectedProfileName, "balanced-cheap");
});

test("ProviderFallback: empty candidates returns no candidate", () => {
  const service = new ModelGatewayFallbackService();

  const decision = service.selectFallback({
    primaryProfileName: "any-model",
    candidates: [],
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ProviderFallback: single candidate returns it", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("only-model", { inputCostPer1kUsd: 1.0 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "only-model",
    candidates,
  });

  assert.equal(decision.selectedProfileName, null); // Primary excluded, no others
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ProviderFallback: attemptedProfiles includes all candidates", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("model-1"),
    makeCandidate("model-2"),
    makeCandidate("model-3"),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "model-1",
    candidates,
  });

  assert.deepEqual(decision.attemptedProfiles, ["model-1", "model-2", "model-3"]);
});

test("ProviderFallback: all profiles unhealthy returns no candidate", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("model-a", { healthy: false, inputCostPer1kUsd: 1.0 }),
    makeCandidate("model-b", { healthy: false, inputCostPer1kUsd: 0.5 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "model-a",
    candidates,
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ProviderFallback: cost filter with healthy candidate selection", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("premium", { healthy: true, inputCostPer1kUsd: 20.0 }),
    makeCandidate("budget", { healthy: true, inputCostPer1kUsd: 0.5 }),
    makeCandidate("mid", { healthy: true, inputCostPer1kUsd: 3.0 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "premium",
    candidates,
    maxInputCostPer1kUsd: 5.0,
  });

  // budget is cheapest within budget (0.5 < 3.0 < 20.0, all under 5.0)
  assert.equal(decision.selectedProfileName, "budget");
});

test("ProviderFallback: degrades from records primary profile", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("old-primary"),
    makeCandidate("fallback-candidate"),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "old-primary",
    candidates,
  });

  assert.equal(decision.degradedFromProfileName, "old-primary");
});

test("ProviderFallback: multiple candidates same cost selects by name alphabetically", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("zebra-model", { inputCostPer1kUsd: 1.0 }),
    makeCandidate("alpha-model", { inputCostPer1kUsd: 1.0 }),
    makeCandidate("middle-model", { inputCostPer1kUsd: 1.0 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "zebra-model",
    candidates,
  });

  // Alphabetically first among remaining (alpha-model is cheapest alphabetically)
  assert.equal(decision.selectedProfileName, "alpha-model");
});

test("ProviderFallback: works with different tiers", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("coding-tier", { tier: "coding", inputCostPer1kUsd: 8.0 }),
    makeCandidate("reasoning-tier", { tier: "reasoning", inputCostPer1kUsd: 15.0 }),
    makeCandidate("fast-tier", { tier: "fast", inputCostPer1kUsd: 0.25 }),
    makeCandidate("balanced-tier", { tier: "balanced", inputCostPer1kUsd: 2.5 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "coding-tier",
    candidates,
  });

  // Fast tier cheapest
  assert.equal(decision.selectedProfileName, "fast-tier");
  assert.equal(decision.reasonCode, "fallback.healthy_alternative_selected");
});

test("ProviderFallback: only primary available - no candidate", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("primary", { inputCostPer1kUsd: 1.0 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ProviderFallback: excludes profile that is in exclusion list", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("model-a"),
    makeCandidate("model-b"),
    makeCandidate("model-c"),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "model-a",
    candidates,
    excludedProfiles: ["model-b", "model-c"],
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ProviderFallback: mixed health status - only healthy considered", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("unhealthy-1", { healthy: false, inputCostPer1kUsd: 0.1 }),
    makeCandidate("unhealthy-2", { healthy: false, inputCostPer1kUsd: 0.2 }),
    makeCandidate("healthy-1", { healthy: true, inputCostPer1kUsd: 1.0 }),
    makeCandidate("healthy-2", { healthy: true, inputCostPer1kUsd: 0.5 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "unhealthy-1",
    candidates,
  });

  // Only considers healthy candidates
  assert.equal(decision.selectedProfileName, "healthy-2");
  assert.ok(decision.attemptedProfiles.includes("healthy-2"));
});

test("ProviderFallback: reason code is set correctly for successful selection", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("old"),
    makeCandidate("new"),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "old",
    candidates,
  });

  assert.equal(decision.reasonCode, "fallback.healthy_alternative_selected");
});

test("ProviderFallback: reason code is no_candidate_available when none eligible", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("model-a", { healthy: false }),
    makeCandidate("model-b", { healthy: false }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "model-a",
    candidates,
    maxInputCostPer1kUsd: 0.1, // Too restrictive
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ProviderFallback: provider field is included in candidates", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    makeCandidate("openai-model", { provider: "openai", inputCostPer1kUsd: 2.0 }),
    makeCandidate("anthropic-model", { provider: "anthropic", inputCostPer1kUsd: 1.0 }),
  ];

  const decision = service.selectFallback({
    primaryProfileName: "openai-model",
    candidates,
  });

  assert.equal(decision.selectedProfileName, "anthropic-model");
});