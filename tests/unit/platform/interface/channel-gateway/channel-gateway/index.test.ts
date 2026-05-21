import assert from "node:assert/strict";
import test from "node:test";

import * as GatewayExports from "../../../../../../src/platform/five-plane-interface/channel-gateway/index.js";

// Test that index re-exports expected types and classes from channel-gateway-service
test("index exports ChannelGatewayService", () => {
  assert.ok("ChannelGatewayService" in GatewayExports);
});

test("index exports ChannelAdapterRegistry", () => {
  assert.ok("ChannelAdapterRegistry" in GatewayExports);
});

test("index exports createDefaultChannelAdapterRegistry", () => {
  assert.ok("createDefaultChannelAdapterRegistry" in GatewayExports);
  assert.equal(typeof GatewayExports.createDefaultChannelAdapterRegistry, "function");
});

test("index exports GatewayRateLimitError", () => {
  assert.ok("GatewayRateLimitError" in GatewayExports);
});

// Test re-exports from channel-gateway-delivery-support
test("index re-exports CHANNEL_DELIVERY_DDL from delivery-support", () => {
  assert.ok("CHANNEL_DELIVERY_DDL" in GatewayExports);
  assert.equal(typeof GatewayExports.CHANNEL_DELIVERY_DDL, "string");
  assert.ok(GatewayExports.CHANNEL_DELIVERY_DDL.includes("CREATE TABLE"));
});

test("index re-exports DEFAULT_DELIVERY_CONFIG from delivery-support", () => {
  assert.ok("DEFAULT_DELIVERY_CONFIG" in GatewayExports);
});

test("index re-exports DEFAULT_RATE_LIMIT_CONFIG from delivery-support", () => {
  assert.ok("DEFAULT_RATE_LIMIT_CONFIG" in GatewayExports);
});

// Test re-exports from channel-gateway-retry-executor
test("index re-exports ChannelGatewayRetryExecutor", () => {
  assert.ok("ChannelGatewayRetryExecutor" in GatewayExports);
});

// Test that createDefaultChannelAdapterRegistry returns working registry
test("createDefaultChannelAdapterRegistry returns working registry", () => {
  const registry = GatewayExports.createDefaultChannelAdapterRegistry();
  assert.ok(registry.has("telegram"));
  assert.ok(registry.has("slack"));
  assert.ok(registry.has("webhook"));
});

// Test that re-exported delivery support functions work
test("index re-exports calculateBackoffForAttempt from delivery-support", () => {
  assert.ok("calculateBackoffForAttempt" in GatewayExports);
  assert.equal(typeof GatewayExports.calculateBackoffForAttempt, "function");
});

test("index re-exports buildDeadLetterQuery from delivery-support", () => {
  assert.ok("buildDeadLetterQuery" in GatewayExports);
  assert.equal(typeof GatewayExports.buildDeadLetterQuery, "function");
});