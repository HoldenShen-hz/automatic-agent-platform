import assert from "node:assert/strict";
import test from "node:test";

import { FencingTokenService } from "../../../../../src/platform/five-plane-state-evidence/events/cas/fencing-token-service.js";

test("sqlite-backed fencing services share fence state across instances", () => {
  const service1 = new FencingTokenService("node-1");
  const service2 = new FencingTokenService("node-2");
  service1.clearAllFences();

  const fence = service1.acquireFence("exec-shared", "exclusive");
  assert.ok(fence != null, "first node should acquire fence");
  assert.equal(service1.isFenceHeld("exec-shared"), true);
  assert.equal(service2.isFenceHeld("exec-shared"), true, "second service should observe the shared fence state");
  assert.equal(service2.acquireFence("exec-shared", "exclusive"), null, "second node must be blocked by persisted fence state");

  assert.equal(service1.releaseFence("exec-shared"), true);
  const reacquired = service2.acquireFence("exec-shared", "exclusive");
  assert.ok(reacquired != null, "second node should acquire after persisted release");
  assert.equal(service2.releaseFence("exec-shared"), true);
});

test("sqlite-backed fencing services share active fence counts", () => {
  const service1 = new FencingTokenService("node-1");
  const service2 = new FencingTokenService("node-2");
  service1.clearAllFences();

  service1.acquireFence("exec-a", "exclusive");
  service2.acquireFence("exec-b", "shared");

  assert.equal(service1.getActiveFenceCount(), 2);
  assert.equal(service2.getActiveFenceCount(), 2);
});
