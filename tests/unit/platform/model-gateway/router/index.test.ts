import assert from "node:assert/strict";
import test from "node:test";

import {
  ModelGatewayCacheService,
  ModelGatewayFallbackService,
  type ModelFallbackCandidate,
} from "../../../../../src/platform/model-gateway/router/index.js";

test("model gateway router barrel exports cache and fallback services", () => {
  const candidates: ModelFallbackCandidate[] = [];
  assert.equal(typeof ModelGatewayCacheService, "function");
  assert.equal(typeof ModelGatewayFallbackService, "function");
  assert.equal(candidates.length, 0);
});
