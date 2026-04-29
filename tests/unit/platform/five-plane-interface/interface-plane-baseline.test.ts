import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  INTERFACE_CAPABILITY_BASELINES,
  listInterfaceCapabilityBaselines,
  resolveInterfaceCapabilityBaseline,
  type InterfaceCapabilityId,
} from "../../../../src/platform/five-plane-interface/interface-plane-baseline.js";

test("listInterfaceCapabilityBaselines returns all 6 capability baselines", () => {
  const baselines = listInterfaceCapabilityBaselines();
  assert.equal(baselines.length, 6, "expected 6 capability baselines");
});

test("listInterfaceCapabilityBaselines returns frozen array", () => {
  const baselines = listInterfaceCapabilityBaselines();
  assert.equal(Object.isFrozen(baselines), true);
});

test("INTERFACE_CAPABILITY_BASELINES contains api capability", () => {
  const api = INTERFACE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "api");
  assert.ok(api, "api capability should exist");
  assert.equal(api.entryModule, "src/platform/interface/api/index.ts");
  assert.ok(api.baselineServices.includes("HttpApiServer"));
});

test("INTERFACE_CAPABILITY_BASELINES contains channel-gateway capability", () => {
  const cg = INTERFACE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "channel-gateway");
  assert.ok(cg, "channel-gateway capability should exist");
  assert.equal(cg.entryModule, "src/platform/interface/channel-gateway/index.ts");
  assert.ok(cg.baselineServices.includes("ChannelGatewayService"));
});

test("INTERFACE_CAPABILITY_BASELINES contains console-backend capability", () => {
  const cb = INTERFACE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "console-backend");
  assert.ok(cb, "console-backend capability should exist");
  assert.equal(cb.entryModule, "src/platform/interface/console-backend/index.ts");
});

test("INTERFACE_CAPABILITY_BASELINES contains ingress capability", () => {
  const ing = INTERFACE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "ingress");
  assert.ok(ing, "ingress capability should exist");
  assert.equal(ing.entryModule, "src/platform/interface/ingress/index.ts");
});

test("INTERFACE_CAPABILITY_BASELINES contains scheduler capability", () => {
  const sched = INTERFACE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "scheduler");
  assert.ok(sched, "scheduler capability should exist");
  assert.equal(sched.entryModule, "src/platform/interface/scheduler/index.ts");
});

test("INTERFACE_CAPABILITY_BASELINES contains webhook capability", () => {
  const wh = INTERFACE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "webhook");
  assert.ok(wh, "webhook capability should exist");
  assert.equal(wh.entryModule, "src/platform/interface/webhook/index.ts");
});

test("resolveInterfaceCapabilityBaseline resolves valid capability", () => {
  const baseline = resolveInterfaceCapabilityBaseline("api");
  assert.equal(baseline.capabilityId, "api");
  assert.equal(baseline.entryModule, "src/platform/interface/api/index.ts");
});

test("resolveInterfaceCapabilityBaseline throws for unknown capability", () => {
  assert.throws(
    () => resolveInterfaceCapabilityBaseline("unknown" as InterfaceCapabilityId),
    /interface_capability.not_found:unknown/,
  );
});

test("capability baselines have required fields", () => {
  for (const baseline of INTERFACE_CAPABILITY_BASELINES) {
    assert.ok(typeof baseline.capabilityId === "string");
    assert.ok(typeof baseline.entryModule === "string");
    assert.ok(typeof baseline.description === "string");
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0);
  }
});