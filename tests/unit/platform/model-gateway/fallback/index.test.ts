import assert from "node:assert/strict";
import test from "node:test";

import { ModelGatewayFallbackService } from "../../../../../src/platform/model-gateway/fallback/index.js";

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
