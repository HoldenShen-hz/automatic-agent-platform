/**
 * Extended unit tests for Model Gateway Baseline functions
 * Tests listModelGatewayCapabilityBaselines and resolveModelGatewayCapabilityBaseline
 * with additional edge cases and validation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MODEL_GATEWAY_CAPABILITY_BASELINES,
  listModelGatewayCapabilityBaselines,
  resolveModelGatewayCapabilityBaseline,
  type ModelGatewayCapabilityId,
} from "../../../../src/platform/model-gateway/model-gateway-baseline.js";

test("listModelGatewayCapabilityBaselines returns all capability baselines", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  assert.ok(baselines.length > 0);
  assert.equal(baselines.length, MODEL_GATEWAY_CAPABILITY_BASELINES.length);
});

test("listModelGatewayCapabilityBaselines returns frozen array", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  assert.equal(Object.isFrozen(baselines), true);
});

test("each baseline has required fields", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(baseline.capabilityId);
    assert.ok(baseline.entryModule);
    assert.ok(baseline.description);
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0);
  }
});

test("all capability IDs are unique", () => {
  const baselines = listModelGatewayCapabilityBaselines();
  const ids = baselines.map((b) => b.capabilityId);
  const uniqueIds = new Set(ids);

  assert.equal(ids.length, uniqueIds.size);
});

test("resolveModelGatewayCapabilityBaseline resolves all valid capability IDs", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  for (const baseline of baselines) {
    const resolved = resolveModelGatewayCapabilityBaseline(baseline.capabilityId);
    assert.equal(resolved.capabilityId, baseline.capabilityId);
    assert.equal(resolved.entryModule, baseline.entryModule);
  }
});

test("resolveModelGatewayCapabilityBaseline throws for unknown capability", () => {
  assert.throws(
    () => resolveModelGatewayCapabilityBaseline("unknown-capability" as ModelGatewayCapabilityId),
    /model_gateway_capability.not_found/,
  );
});

test("all capability IDs are valid ModelGatewayCapabilityId type", () => {
  const validIds: ModelGatewayCapabilityId[] = [
    "provider-registry",
    "router",
    "fallback",
    "degradation",
    "cost-tracker",
    "messages",
  ];

  const baselines = listModelGatewayCapabilityBaselines();
  const baselineIds = baselines.map((b) => b.capabilityId);

  for (const id of validIds) {
    assert.ok(
      baselineIds.includes(id),
      `Expected ${id} to be in baseline capability IDs`,
    );
  }
});

test("entryModule paths are valid TypeScript module paths", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(baseline.entryModule.startsWith("src/platform/model-gateway/"));
    assert.ok(baseline.entryModule.endsWith(".ts") || baseline.entryModule.endsWith("/index.js"));
  }
});

test("provider-registry baseline has correct structure", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("provider-registry");

  assert.equal(baseline.capabilityId, "provider-registry");
  assert.ok(baseline.description.length > 0);
  assert.ok(baseline.baselineServices.includes("ProviderCredentialPool"));
  assert.ok(baseline.baselineServices.includes("UnifiedChatProvider"));
});

test("router baseline includes ModelRoutingService", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("router");

  assert.ok(baseline.baselineServices.includes("ModelRoutingService"));
});

test("fallback baseline includes ModelGatewayFallbackService", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("fallback");

  assert.ok(baseline.baselineServices.includes("ModelGatewayFallbackService"));
});

test("degradation baseline includes DegradationController", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("degradation");

  assert.ok(baseline.baselineServices.includes("DegradationController"));
});

test("cost-tracker baseline includes BudgetGuard", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("cost-tracker");

  assert.ok(baseline.baselineServices.includes("BudgetGuard"));
});

test("messages baseline includes buildMessageParts and estimateMessageTokens", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("messages");

  assert.ok(baseline.baselineServices.includes("buildMessageParts"));
  assert.ok(baseline.baselineServices.includes("estimateMessageTokens"));
});

test("baseline services arrays are readonly", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("provider-registry");

  assert.equal(Object.isFrozen(baseline.baselineServices), true);
});

test("baseline descriptions are non-empty", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(baseline.description.length > 0, `Empty description for ${baseline.capabilityId}`);
  }
});

test("each baseline description is relevant to its capability", () => {
  const baselines = listModelGatewayCapabilityBaselines();
  const expectedKeywords: Record<string, string[]> = {
    "provider-registry": ["provider", "vendor", "registration"],
    router: ["routing", "route", "dispatch"],
    fallback: ["fallback", "recovery", "downgrade"],
    degradation: ["degradation", "availability", "throttling"],
    "cost-tracker": ["cost", "token", "chargeback", "budget"],
    messages: ["message", "request", "response", "payload"],
  };

  for (const baseline of baselines) {
    const description = baseline.description.toLowerCase();
    assert.ok(
      expectedKeywords[baseline.capabilityId]?.some((keyword) => description.includes(keyword)) ?? false,
      `Description for ${baseline.capabilityId} should be relevant: "${baseline.description}"`,
    );
  }
});

test("capability IDs follow naming convention", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  for (const baseline of baselines) {
    // Capability IDs should be kebab-case
    assert.ok(
      /^[a-z]+(-[a-z]+)*$/.test(baseline.capabilityId),
      `Invalid capability ID format: ${baseline.capabilityId}`,
    );
  }
});

test("all entry module paths are absolute from src", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  for (const baseline of baselines) {
    // Entry module should be a valid path starting from src/platform/model-gateway
    assert.ok(
      baseline.entryModule.startsWith("src/platform/model-gateway/"),
      `Invalid entry module path for ${baseline.capabilityId}: ${baseline.entryModule}`,
    );
  }
});

test("provider-registry baseline entry module is correct", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("provider-registry");

  assert.equal(baseline.entryModule, "src/platform/model-gateway/provider-registry/index.ts");
});

test("router baseline entry module is correct", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("router");

  assert.equal(baseline.entryModule, "src/platform/model-gateway/router/index.ts");
});

test("fallback baseline entry module is correct", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("fallback");

  assert.equal(baseline.entryModule, "src/platform/model-gateway/fallback/index.ts");
});

test("degradation baseline entry module is correct", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("degradation");

  assert.equal(baseline.entryModule, "src/platform/model-gateway/degradation/index.ts");
});

test("cost-tracker baseline entry module is correct", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("cost-tracker");

  assert.equal(baseline.entryModule, "src/platform/model-gateway/cost-tracker/index.ts");
});

test("messages baseline entry module is correct", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("messages");

  assert.equal(baseline.entryModule, "src/platform/model-gateway/messages/index.ts");
});
