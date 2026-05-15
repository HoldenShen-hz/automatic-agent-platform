import test from "node:test";
import assert from "node:assert/strict";

import {
  listInterfaceCapabilityBaselines,
  resolveInterfaceCapabilityBaseline,
} from "../../../../src/platform/five-plane-interface/interface-plane-baseline.js";

test("listInterfaceCapabilityBaselines returns all six capabilities", () => {
  const baselines = listInterfaceCapabilityBaselines();

  assert.equal(baselines.length, 6);
});

test("listInterfaceCapabilityBaselines includes api capability", () => {
  const baselines = listInterfaceCapabilityBaselines();

  const api = baselines.find((b) => b.capabilityId === "api");
  assert.ok(api != null);
  assert.equal(api!.entryModule, "src/platform/five-plane-interface/api/index.ts");
  assert.ok(api!.baselineServices.includes("HttpApiServer"));
  assert.ok(api!.baselineServices.includes("ApiResourceCatalogService"));
});

test("listInterfaceCapabilityBaselines includes channel-gateway capability", () => {
  const baselines = listInterfaceCapabilityBaselines();

  const cg = baselines.find((b) => b.capabilityId === "channel-gateway");
  assert.ok(cg != null);
  assert.equal(cg!.entryModule, "src/platform/five-plane-interface/channel-gateway/index.ts");
  assert.ok(cg!.baselineServices.includes("ChannelGatewayService"));
});

test("listInterfaceCapabilityBaselines includes console-backend capability", () => {
  const baselines = listInterfaceCapabilityBaselines();

  const cb = baselines.find((b) => b.capabilityId === "console-backend");
  assert.ok(cb != null);
  assert.equal(cb!.entryModule, "src/platform/five-plane-interface/console-backend/index.ts");
  assert.ok(cb!.baselineServices.includes("OperatorConsoleBackendService"));
});

test("listInterfaceCapabilityBaselines includes ingress capability", () => {
  const baselines = listInterfaceCapabilityBaselines();

  const ingress = baselines.find((b) => b.capabilityId === "ingress");
  assert.ok(ingress != null);
  assert.equal(ingress!.entryModule, "src/platform/five-plane-interface/ingress/index.ts");
  assert.ok(ingress!.baselineServices.includes("IngressGovernanceService"));
});

test("listInterfaceCapabilityBaselines includes scheduler capability", () => {
  const baselines = listInterfaceCapabilityBaselines();

  const scheduler = baselines.find((b) => b.capabilityId === "scheduler");
  assert.ok(scheduler != null);
  assert.equal(scheduler!.entryModule, "src/platform/five-plane-interface/scheduler/index.ts");
  assert.ok(scheduler!.baselineServices.includes("LongRunningWorkflowService"));
});

test("listInterfaceCapabilityBaselines includes webhook capability", () => {
  const baselines = listInterfaceCapabilityBaselines();

  const webhook = baselines.find((b) => b.capabilityId === "webhook");
  assert.ok(webhook != null);
  assert.equal(webhook!.entryModule, "src/platform/five-plane-interface/webhook/index.ts");
  assert.ok(webhook!.baselineServices.includes("WebhookIngressService"));
});

test("resolveInterfaceCapabilityBaseline resolves valid capability", () => {
  const baseline = resolveInterfaceCapabilityBaseline("api");

  assert.equal(baseline.capabilityId, "api");
  assert.ok(baseline.description.length > 0);
});

test("resolveInterfaceCapabilityBaseline throws for unknown capability", () => {
  assert.throws(
    () => resolveInterfaceCapabilityBaseline("unknown" as "api"),
    (err: unknown) => {
      return (err as Error).message.includes("interface_capability.not_found");
    },
  );
});

test("all capability IDs are covered by resolveInterfaceCapabilityBaseline", () => {
  const baselines = listInterfaceCapabilityBaselines();

  for (const baseline of baselines) {
    const resolved = resolveInterfaceCapabilityBaseline(baseline.capabilityId);
    assert.ok(resolved != null);
    assert.equal(resolved.capabilityId, baseline.capabilityId);
  }
});

test("capability baselines are frozen", () => {
  const baselines = listInterfaceCapabilityBaselines();

  assert.ok(Object.isFrozen(baselines));
});

test("each baseline has required fields", () => {
  const baselines = listInterfaceCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(baseline.capabilityId.length > 0);
    assert.ok(baseline.entryModule.length > 0);
    assert.ok(baseline.description.length > 0);
    assert.ok(baseline.baselineServices.length > 0);
    assert.ok(Array.isArray(baseline.baselineServices));
  }
});
