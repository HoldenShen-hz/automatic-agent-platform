import assert from "node:assert/strict";
import test from "node:test";

import {
  BudgetGuard,
  buildModelGatewayBootstrap,
  DegradationController,
  estimateMessageTokens,
  ModelGatewayFallbackService,
  ModelRoutingService,
  ProviderCredentialPool,
} from "../../../../src/platform/model-gateway/index.js";

test("model-gateway root barrel exposes canonical routing, fallback, and governance helpers", () => {
  assert.equal(typeof ProviderCredentialPool, "function");
  assert.equal(typeof ModelRoutingService, "function");
  assert.equal(typeof ModelGatewayFallbackService, "function");
  assert.equal(typeof DegradationController, "function");
  assert.equal(typeof BudgetGuard, "function");
  assert.equal(typeof estimateMessageTokens, "function");
  assert.equal(typeof buildModelGatewayBootstrap, "function");
});
