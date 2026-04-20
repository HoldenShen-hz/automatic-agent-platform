import assert from "node:assert/strict";
import test from "node:test";

import {
  ModelGatewayCacheService,
  ModelGatewayFallbackService,
} from "../../../../src/platform/model-gateway/router/index.js";

test("integration: model gateway fallback decision can be cached by route key", () => {
  const cache = new ModelGatewayCacheService<{ profileName: string | null }>();
  const fallback = new ModelGatewayFallbackService();
  const decision = fallback.selectFallback({
    primaryProfileName: "primary",
    candidates: [
      { profileName: "primary", provider: "openai", tier: "reasoning", healthy: false, inputCostPer1kUsd: 1.0 },
      { profileName: "fallback", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.2 },
    ],
  });
  const cacheKey = cache.buildCacheKey({
    tenantId: "tenant-1",
    model: "router",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "route this request" }],
  });
  cache.put({
    cacheKey,
    tenantId: "tenant-1",
    model: "router",
    routeClass: "reasoning",
    value: { profileName: decision.selectedProfileName },
  });

  assert.equal(decision.selectedProfileName, "fallback");
  assert.equal(cache.get(cacheKey)?.value.profileName, "fallback");
});
