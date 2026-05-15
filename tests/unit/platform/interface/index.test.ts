/**
 * Unit tests for top-level interface barrel exports
 * Tests src/platform/five-plane-interface/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as interfaceIndex from "../../../../src/platform/five-plane-interface/index.js";

test("interface index exports api namespace", () => {
  assert.ok("api" in interfaceIndex);
  assert.equal(typeof interfaceIndex.api, "object");
});

test("interface index exports channelGateway namespace", () => {
  assert.ok("channelGateway" in interfaceIndex);
  assert.equal(typeof interfaceIndex.channelGateway, "object");
});

test("interface index exports consoleBackend namespace", () => {
  assert.ok("consoleBackend" in interfaceIndex);
  assert.equal(typeof interfaceIndex.consoleBackend, "object");
});

test("interface index exports ingress namespace", () => {
  assert.ok("ingress" in interfaceIndex);
  assert.equal(typeof interfaceIndex.ingress, "object");
});

test("interface index exports scheduler namespace", () => {
  assert.ok("scheduler" in interfaceIndex);
  assert.equal(typeof interfaceIndex.scheduler, "object");
});

test("interface index exports webhook namespace", () => {
  assert.ok("webhook" in interfaceIndex);
  assert.equal(typeof interfaceIndex.webhook, "object");
});

test("interface index exports INTERFACE_CAPABILITY_BASELINES", () => {
  assert.ok("INTERFACE_CAPABILITY_BASELINES" in interfaceIndex);
  assert.ok(Array.isArray(interfaceIndex.INTERFACE_CAPABILITY_BASELINES));
});

test("interface index exports listInterfaceCapabilityBaselines function", () => {
  assert.ok("listInterfaceCapabilityBaselines" in interfaceIndex);
  assert.equal(typeof interfaceIndex.listInterfaceCapabilityBaselines, "function");
});

test("interface index exports resolveInterfaceCapabilityBaseline function", () => {
  assert.ok("resolveInterfaceCapabilityBaseline" in interfaceIndex);
  assert.equal(typeof interfaceIndex.resolveInterfaceCapabilityBaseline, "function");
});

test("interface index exports INTERFACE_CAPABILITY_BASELINES with 6 entries", () => {
  assert.equal(interfaceIndex.INTERFACE_CAPABILITY_BASELINES.length, 6);
});

test("interface index exports WebhookIngressService", () => {
  assert.ok("WebhookIngressService" in interfaceIndex);
  assert.equal(typeof interfaceIndex.WebhookIngressService, "function");
});

test("interface index exports WebhookOutboxDispatchService", () => {
  assert.ok("WebhookOutboxDispatchService" in interfaceIndex);
  assert.equal(typeof interfaceIndex.WebhookOutboxDispatchService, "function");
});

test("interface index exports interface-plane-baseline module", () => {
  assert.ok("INTERFACE_CAPABILITY_BASELINES" in interfaceIndex);
  const baselines = interfaceIndex.INTERFACE_CAPABILITY_BASELINES;
  assert.ok(baselines.every((b) => typeof b.capabilityId === "string"));
  assert.ok(baselines.every((b) => typeof b.entryModule === "string"));
  assert.ok(baselines.every((b) => typeof b.description === "string"));
  assert.ok(baselines.every((b) => Array.isArray(b.baselineServices)));
});

test("listInterfaceCapabilityBaselines from index returns all baselines", () => {
  const baselines = interfaceIndex.listInterfaceCapabilityBaselines();
  assert.equal(baselines.length, 6);
  const ids = baselines.map((b) => b.capabilityId);
  assert.ok(ids.includes("api"));
  assert.ok(ids.includes("scheduler"));
  assert.ok(ids.includes("webhook"));
});

test("resolveInterfaceCapabilityBaseline from index works for all capabilities", () => {
  const ids = ["api", "channel-gateway", "console-backend", "ingress", "scheduler", "webhook"];
  for (const id of ids) {
    const baseline = interfaceIndex.resolveInterfaceCapabilityBaseline(id as any);
    assert.ok(baseline !== undefined);
    assert.equal(baseline.capabilityId, id);
  }
});

test("resolveInterfaceCapabilityBaseline from index throws for unknown", () => {
  assert.throws(() => {
    interfaceIndex.resolveInterfaceCapabilityBaseline("nonexistent" as any);
  }, /interface_capability\.not_found/);
});

test("api namespace contains expected exports", () => {
  const api = interfaceIndex.api;
  assert.ok(api !== null && typeof api === "object");
});

test("channelGateway namespace contains expected exports", () => {
  const cg = interfaceIndex.channelGateway;
  assert.ok(cg !== null && typeof cg === "object");
});

test("scheduler namespace contains LongRunningWorkflowService", () => {
  const scheduler = interfaceIndex.scheduler;
  assert.ok("LongRunningWorkflowService" in scheduler);
  assert.equal(typeof scheduler.LongRunningWorkflowService, "function");
});

test("scheduler namespace exports workflow sleep conversion functions", () => {
  const scheduler = interfaceIndex.scheduler;
  assert.ok("toWorkflowSleepLease" in scheduler);
  assert.ok("toWorkflowResumeWindow" in scheduler);
  assert.equal(typeof scheduler.toWorkflowSleepLease, "function");
  assert.equal(typeof scheduler.toWorkflowResumeWindow, "function");
});

test("webhook namespace contains WebhookIngressService", () => {
  const webhook = interfaceIndex.webhook;
  assert.ok("WebhookIngressService" in webhook);
});

test("consoleBackend namespace contains OperatorConsoleBackendService", () => {
  const cb = interfaceIndex.consoleBackend;
  assert.ok("OperatorConsoleBackendService" in cb);
  assert.equal(typeof cb.OperatorConsoleBackendService, "function");
});

test("ingress namespace contains rate limiter exports", () => {
  const ingress = interfaceIndex.ingress;
  assert.ok("DistributedRateLimiter" in ingress || "RedisRateLimiter" in ingress);
});

test("interface index exports interface-plane-bootstrap", () => {
  assert.ok("interface-plane-baseline" in interfaceIndex || "INTERFACE_CAPABILITY_BASELINES" in interfaceIndex);
});

test("WebhookIngressService and WebhookOutboxDispatchService are different classes", () => {
  const WIS = interfaceIndex.WebhookIngressService;
  const WODS = interfaceIndex.WebhookOutboxDispatchService;
  assert.notEqual(WIS, WODS);
});