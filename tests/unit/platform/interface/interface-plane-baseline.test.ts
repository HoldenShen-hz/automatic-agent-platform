import assert from "node:assert/strict";
import test from "node:test";

import {
  listInterfaceCapabilityBaselines,
  resolveInterfaceCapabilityBaseline,
  INTERFACE_CAPABILITY_BASELINES,
  type InterfaceCapabilityBaseline,
} from "../../../../src/platform/five-plane-interface/interface-plane-baseline.js";

test("interface plane baseline covers interface entry modules", () => {
  const baselines = listInterfaceCapabilityBaselines();
  assert.deepEqual(
    baselines.map((item) => item.capabilityId),
    ["api", "channel-gateway", "console-backend", "ingress", "scheduler", "webhook"],
  );
  assert.ok(resolveInterfaceCapabilityBaseline("webhook").baselineServices.includes("WebhookIngressService"));
});

test("listInterfaceCapabilityBaselines returns all capability baselines", () => {
  const baselines = listInterfaceCapabilityBaselines();
  assert.equal(baselines.length, 6);
  baselines.forEach((baseline) => {
    assert.ok(baseline.capabilityId.length > 0);
    assert.ok(baseline.entryModule.length > 0);
    assert.ok(baseline.description.length > 0);
    assert.ok(Array.isArray(baseline.baselineServices));
  });
});

test("INTERFACE_CAPABILITY_BASELINES outer array is frozen", () => {
  assert.ok(Object.isFrozen(INTERFACE_CAPABILITY_BASELINES));
  // Note: Object.freeze is shallow, so nested arrays may or may not be frozen
  // depending on how they were created
});

test("resolveInterfaceCapabilityBaseline returns correct baseline for api", () => {
  const baseline = resolveInterfaceCapabilityBaseline("api");
  assert.equal(baseline.capabilityId, "api");
  assert.ok(baseline.entryModule.includes("api"));
  assert.ok(baseline.baselineServices.includes("HttpApiServer"));
});

test("resolveInterfaceCapabilityBaseline returns correct baseline for channel-gateway", () => {
  const baseline = resolveInterfaceCapabilityBaseline("channel-gateway");
  assert.equal(baseline.capabilityId, "channel-gateway");
  assert.ok(baseline.entryModule.includes("channel-gateway"));
  assert.ok(baseline.baselineServices.includes("ChannelGatewayService"));
});

test("resolveInterfaceCapabilityBaseline returns correct baseline for console-backend", () => {
  const baseline = resolveInterfaceCapabilityBaseline("console-backend");
  assert.equal(baseline.capabilityId, "console-backend");
  assert.ok(baseline.entryModule.includes("console-backend"));
  assert.ok(baseline.baselineServices.includes("OperatorConsoleBackendService"));
});

test("resolveInterfaceCapabilityBaseline returns correct baseline for ingress", () => {
  const baseline = resolveInterfaceCapabilityBaseline("ingress");
  assert.equal(baseline.capabilityId, "ingress");
  assert.ok(baseline.entryModule.includes("ingress"));
  assert.ok(baseline.baselineServices.includes("IngressGovernanceService"));
});

test("resolveInterfaceCapabilityBaseline returns correct baseline for scheduler", () => {
  const baseline = resolveInterfaceCapabilityBaseline("scheduler");
  assert.equal(baseline.capabilityId, "scheduler");
  assert.ok(baseline.entryModule.includes("scheduler"));
  assert.ok(baseline.baselineServices.includes("LongRunningWorkflowService"));
});

test("resolveInterfaceCapabilityBaseline returns correct baseline for webhook", () => {
  const baseline = resolveInterfaceCapabilityBaseline("webhook");
  assert.equal(baseline.capabilityId, "webhook");
  assert.ok(baseline.entryModule.includes("webhook"));
  assert.ok(baseline.baselineServices.includes("WebhookIngressService"));
});

test("resolveInterfaceCapabilityBaseline throws for unknown capability", () => {
  assert.throws(
    () => resolveInterfaceCapabilityBaseline("unknown" as any),
    (err: unknown) => err instanceof Error && err.message.includes("interface_capability.not_found"),
  );
});

test("resolveInterfaceCapabilityBaseline throws with correct error format", () => {
  try {
    resolveInterfaceCapabilityBaseline("invalid" as any);
    assert.fail("should have thrown");
  } catch (err: any) {
    assert.ok(err.message.includes("invalid"));
  }
});

test("each capability baseline has required fields", () => {
  const baselines = listInterfaceCapabilityBaselines();
  baselines.forEach((baseline: InterfaceCapabilityBaseline) => {
    assert.ok(typeof baseline.capabilityId === "string");
    assert.ok(typeof baseline.entryModule === "string");
    assert.ok(typeof baseline.description === "string");
    assert.ok(baseline.description.length > 10); // Should be meaningful
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0); // Each should have at least one service
  });
});

test("capability baselines are in correct order", () => {
  const baselines = listInterfaceCapabilityBaselines();
  const expectedOrder = ["api", "channel-gateway", "console-backend", "ingress", "scheduler", "webhook"];
  assert.deepEqual(baselines.map((b) => b.capabilityId), expectedOrder);
});
