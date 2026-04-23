/**
 * Integration Test: Model Gateway Bootstrap and Baseline
 *
 * Verifies model gateway capability catalog and bootstrap functionality.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  listModelGatewayCapabilityBaselines,
  resolveModelGatewayCapabilityBaseline,
  MODEL_GATEWAY_CAPABILITY_BASELINES,
} from "../../../../src/platform/model-gateway/model-gateway-baseline.js";
import {
  buildModelGatewayBootstrap,
  registerModelGatewayBootstrap,
  MODEL_GATEWAY_CATALOG_SERVICE_ID,
  MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
} from "../../../../src/platform/model-gateway/model-gateway-bootstrap.js";

test("ModelGatewayBaseline: listModelGatewayCapabilityBaselines returns all capabilities", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  assert.ok(baselines.length > 0, "Should have at least one capability baseline");

  const capabilityIds = baselines.map((b) => b.capabilityId);
  assert.ok(capabilityIds.includes("provider-registry"));
  assert.ok(capabilityIds.includes("router"));
  assert.ok(capabilityIds.includes("fallback"));
  assert.ok(capabilityIds.includes("degradation"));
  assert.ok(capabilityIds.includes("cost-tracker"));
  assert.ok(capabilityIds.includes("messages"));
});

test("ModelGatewayBaseline: each baseline has required fields", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(typeof baseline.capabilityId === "string", "capabilityId should be string");
    assert.ok(typeof baseline.entryModule === "string", "entryModule should be string");
    assert.ok(typeof baseline.description === "string", "description should be string");
    assert.ok(Array.isArray(baseline.baselineServices), "baselineServices should be array");
    assert.ok(baseline.baselineServices.length > 0, "baselineServices should not be empty");
  }
});

test("ModelGatewayBaseline: resolveModelGatewayCapabilityBaseline finds existing capability", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("provider-registry");

  assert.equal(baseline.capabilityId, "provider-registry");
  assert.ok(baseline.entryModule.includes("provider-registry"));
});

test("ModelGatewayBaseline: resolveModelGatewayCapabilityBaseline throws for unknown capability", () => {
  assert.throws(
    () => resolveModelGatewayCapabilityBaseline("unknown-capability" as any),
    /model_gateway_capability.not_found/,
  );
});

test("ModelGatewayBaseline: MODEL_GATEWAY_CAPABILITY_BASELINES is frozen", () => {
  assert.ok(Object.isFrozen(MODEL_GATEWAY_CAPABILITY_BASELINES), "Should be frozen");
});

test("ModelGatewayBaseline: provider-registry baseline has correct services", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("provider-registry");

  assert.ok(baseline.baselineServices.includes("ProviderCredentialPool"));
  assert.ok(baseline.baselineServices.includes("UnifiedChatProvider"));
});

test("ModelGatewayBaseline: router baseline has ModelRoutingService", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("router");

  assert.ok(baseline.baselineServices.includes("ModelRoutingService"));
});

test("ModelGatewayBaseline: fallback baseline has ModelGatewayFallbackService", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("fallback");

  assert.ok(baseline.baselineServices.includes("ModelGatewayFallbackService"));
});

test("ModelGatewayBaseline: degradation baseline has DegradationController", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("degradation");

  assert.ok(baseline.baselineServices.includes("DegradationController"));
});

test("ModelGatewayBaseline: cost-tracker baseline has BudgetGuard", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("cost-tracker");

  assert.ok(baseline.baselineServices.includes("BudgetGuard"));
});

test("ModelGatewayBaseline: messages baseline has buildMessageParts and estimateMessageTokens", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("messages");

  assert.ok(baseline.baselineServices.includes("buildMessageParts"));
  assert.ok(baseline.baselineServices.includes("estimateMessageTokens"));
});

test("ModelGatewayBootstrap: buildModelGatewayBootstrap returns correct structure", () => {
  const bootstrap = buildModelGatewayBootstrap();

  assert.equal(bootstrap.capabilityGroupId, "model-gateway");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.ok(bootstrap.catalog.length > 0);
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
  assert.ok(bootstrap.registeredServiceIds.includes(MODEL_GATEWAY_CATALOG_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID));
});

test("ModelGatewayBootstrap: buildModelGatewayBootstrap catalog matches baseline", () => {
  const bootstrap = buildModelGatewayBootstrap();
  const baselines = listModelGatewayCapabilityBaselines();

  assert.equal(bootstrap.catalog.length, baselines.length);
});

test("ModelGatewayBootstrap: registerModelGatewayBootstrap registers services", () => {
  const bootstrap = registerModelGatewayBootstrap();

  assert.ok(bootstrap);
  assert.equal(bootstrap.capabilityGroupId, "model-gateway");
  assert.ok(bootstrap.catalog.length > 0);
});

test("ModelGatewayBootstrap: registered service IDs are correct", () => {
  const bootstrap = buildModelGatewayBootstrap();

  assert.ok(bootstrap.registeredServiceIds.includes("aiops.model-gateway.catalog"));
  assert.ok(bootstrap.registeredServiceIds.includes("aiops.model-gateway.bootstrap"));
});
