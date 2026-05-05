import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryCasService } from "../../../../../src/platform/state-evidence/events/cas/cas-service.js";
import {
  FencingTokenService,
  type FenceMode,
  type FenceInfo,
  type FencingTokenValidation,
} from "../../../../../src/platform/state-evidence/events/cas/fencing-token-service.js";

// Clear static fences before/after each FencingTokenService test to avoid state pollution
test.beforeEach(() => {
  // Clear any fences from previous tests
  const service = new FencingTokenService();
  service.clearAllFences();
});

test.afterEach(() => {
  // Clean up after each test
  const service = new FencingTokenService();
  service.clearAllFences();
});

// ============================================================================
// CasService Tests
// ============================================================================

test("CasService compareAndSwap succeeds when key does not exist and expected value is empty", () => {
  const service = createService();
  const result = service.compareAndSwap("key1", "", "newValue");
  assert.equal(result.success, true);
  assert.equal(result.currentValue, "newValue");
  assert.equal(result.currentVersion, 1);
});

test("CasService compareAndSwap succeeds when key does not exist and expected value is null", () => {
  const service = createService();
  const result = service.compareAndSwap("key1", null as unknown as string, "newValue");
  assert.equal(result.success, true);
  assert.equal(result.currentValue, "newValue");
  assert.equal(result.currentVersion, 1);
});

test("CasService compareAndSwap succeeds when key does not exist and expected value is undefined", () => {
  const service = createService();
  const result = service.compareAndSwap("key1", undefined as unknown as string, "newValue");
  assert.equal(result.success, true);
  assert.equal(result.currentValue, "newValue");
  assert.equal(result.currentVersion, 1);
});

test("CasService compareAndSwap fails when key does not exist and expected value is non-empty", () => {
  const service = createService();
  const result = service.compareAndSwap("key1", "wrongExpected", "newValue");
  assert.equal(result.success, false);
});

test("CasService compareAndSwap fails when current value does not match expected value", () => {
  const service = createService();
  service.setValue("key1", "currentValue");
  const result = service.compareAndSwap("key1", "wrongExpected", "newValue");
  assert.equal(result.success, false);
  assert.equal(result.currentValue, "currentValue");
  assert.equal(result.currentVersion, 1);
});

test("CasService compareAndSwap succeeds when current value matches expected value", () => {
  const service = createService();
  service.setValue("key1", "currentValue");
  const result = service.compareAndSwap("key1", "currentValue", "newValue");
  assert.equal(result.success, true);
  assert.equal(result.currentValue, "newValue");
  assert.equal(result.currentVersion, 2);
});

test("CasService compareAndSwap increments version on success", () => {
  const service = createService();
  service.setValue("key1", "value1");
  assert.equal(service.getVersion("key1"), 1);

  service.compareAndSwap("key1", "value1", "value2");
  assert.equal(service.getVersion("key1"), 2);

  service.compareAndSwap("key1", "value2", "value3");
  assert.equal(service.getVersion("key1"), 3);
});

test("CasService compareAndSet succeeds when key does not exist and expected version is 0", () => {
  const service = createService();
  const result = service.compareAndSet("key1", 0, "newValue");
  assert.equal(result.success, true);
  assert.equal(result.currentValue, "newValue");
  assert.equal(result.currentVersion, 1);
});

test("CasService compareAndSet fails when key does not exist and expected version is not 0", () => {
  const service = createService();
  const result = service.compareAndSet("key1", 1, "newValue");
  assert.equal(result.success, false);
});

test("CasService compareAndSet fails when current version does not match expected version", () => {
  const service = createService();
  service.setValue("key1", "value1");
  const result = service.compareAndSet("key1", 5, "newValue");
  assert.equal(result.success, false);
  assert.equal(result.currentValue, "value1");
  assert.equal(result.currentVersion, 1);
});

test("CasService compareAndSet succeeds when current version matches expected version", () => {
  const service = createService();
  service.setValue("key1", "value1");
  const result = service.compareAndSet("key1", 1, "newValue");
  assert.equal(result.success, true);
  assert.equal(result.currentValue, "newValue");
  assert.equal(result.currentVersion, 2);
});

test("CasService getValue returns undefined for non-existent key", () => {
  const service = createService();
  assert.equal(service.getValue("nonexistent"), undefined);
});

test("CasService getValue returns current value for existing key", () => {
  const service = createService();
  service.setValue("key1", "value1");
  assert.equal(service.getValue("key1"), "value1");
});

test("CasService getVersion returns undefined for non-existent key", () => {
  const service = createService();
  assert.equal(service.getVersion("nonexistent"), undefined);
});

test("CasService getVersion returns current version for existing key", () => {
  const service = createService();
  service.setValue("key1", "value1");
  assert.equal(service.getVersion("key1"), 1);
});

test("CasService setValue initializes version to 1", () => {
  const service = createService();
  service.setValue("key1", "value1");
  assert.equal(service.getVersion("key1"), 1);
  assert.equal(service.getValue("key1"), "value1");
});

test("CasService delete returns true for existing key", () => {
  const service = createService();
  service.setValue("key1", "value1");
  assert.equal(service.delete("key1"), true);
  assert.equal(service.has("key1"), false);
});

test("CasService delete returns false for non-existent key", () => {
  const service = createService();
  assert.equal(service.delete("nonexistent"), false);
});

test("CasService has returns true for existing key", () => {
  const service = createService();
  service.setValue("key1", "value1");
  assert.equal(service.has("key1"), true);
});

test("CasService has returns false for non-existent key", () => {
  const service = createService();
  assert.equal(service.has("nonexistent"), false);
});

// ============================================================================
// FencingTokenService Tests
// ============================================================================

test("FencingTokenService generateFencingToken generates unique tokens", () => {
  const service = new FencingTokenService("node1");
  const token1 = service.generateFencingToken("exec1", "node1");
  const token2 = service.generateFencingToken("exec1", "node1");
  assert.notEqual(token1, token2);
  assert.ok(token1.includes("exec1"));
  assert.ok(token1.includes("node1"));
});

test("FencingTokenService generateFencingToken includes executionId, nodeId, counter, and timestamp", () => {
  const service = new FencingTokenService("node1");
  const token = service.generateFencingToken("exec1", "node1");
  const parts = token.split("-");
  assert.equal(parts.length, 4);
  assert.equal(parts[0], "exec1");
  assert.equal(parts[1], "node1");
});

test("FencingTokenService validateFencingToken returns invalid for empty token", () => {
  const service = new FencingTokenService("node1");
  const result = service.validateFencingToken("", "node1");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "Empty or invalid token");
});

test("FencingTokenService validateFencingToken returns invalid for whitespace-only token", () => {
  const service = new FencingTokenService("node1");
  const result = service.validateFencingToken("   ", "node1");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "Token format invalid");
});

test("FencingTokenService validateFencingToken returns invalid for malformed token", () => {
  const service = new FencingTokenService("node1");
  const result = service.validateFencingToken("a-b", "node1");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "Token format invalid");
});

test("FencingTokenService validateFencingToken returns invalid when owner does not match", () => {
  const service = new FencingTokenService("node1");
  const token = service.generateFencingToken("exec1", "node1");
  const result = service.validateFencingToken(token, "differentNode");
  assert.equal(result.valid, false);
  assert.equal(result.owner, "node1");
  assert.equal(result.reason, "Token not owned by expected owner");
});

test("FencingTokenService validateFencingToken returns valid when owner matches", () => {
  const service = new FencingTokenService("node1");
  const token = service.generateFencingToken("exec1", "node1");
  const result = service.validateFencingToken(token, "node1");
  assert.equal(result.valid, true);
  assert.equal(result.executionId, "exec1");
  assert.equal(result.owner, "node1");
});

test("FencingTokenService acquireFence creates fence in exclusive mode", () => {
  const service = new FencingTokenService("node1");
  const fence = service.acquireFence("exec1", "exclusive");
  assert.ok(fence !== null);
  assert.equal(fence?.executionId, "exec1");
  assert.equal(fence?.mode, "exclusive");
  assert.equal(fence?.ownerNodeId, "node1");
  assert.ok(fence?.fenceToken.includes("exec1"));
});

test("FencingTokenService acquireFence creates fence in shared mode", () => {
  const service = new FencingTokenService("node1");
  const fence = service.acquireFence("exec1", "shared");
  assert.ok(fence !== null);
  assert.equal(fence?.mode, "shared");
});

test("FencingTokenService acquireFence allows same node to reacquire fence", () => {
  const service = new FencingTokenService("node1");
  service.acquireFence("exec1", "exclusive");
  const fence = service.acquireFence("exec1", "exclusive");
  assert.ok(fence !== null);
});

test("FencingTokenService releaseFence returns true when fence is released", () => {
  const service = new FencingTokenService("node1");
  service.acquireFence("exec1", "exclusive");
  assert.equal(service.releaseFence("exec1"), true);
  assert.equal(service.isFenceHeld("exec1"), false);
});

test("FencingTokenService releaseFence returns false when no fence held", () => {
  const service = new FencingTokenService("node1");
  assert.equal(service.releaseFence("nonexistent"), false);
});

test("FencingTokenService isFenceHeld returns true when fence is held", () => {
  const service = new FencingTokenService("node1");
  service.acquireFence("exec1", "exclusive");
  assert.equal(service.isFenceHeld("exec1"), true);
});

test("FencingTokenService isFenceHeld returns false when no fence held", () => {
  const service = new FencingTokenService("node1");
  assert.equal(service.isFenceHeld("exec1"), false);
});

test("FencingTokenService getFenceInfo returns fence info when fence is held", () => {
  const service = new FencingTokenService("node1");
  service.acquireFence("exec1", "exclusive");
  const info = service.getFenceInfo("exec1");
  assert.ok(info !== undefined);
  assert.equal(info?.executionId, "exec1");
  assert.equal(info?.mode, "exclusive");
});

test("FencingTokenService getFenceInfo returns undefined when no fence held", () => {
  const service = new FencingTokenService("node1");
  assert.equal(service.getFenceInfo("exec1"), undefined);
});

test("FencingTokenService getNodeId returns configured node ID", () => {
  const service = new FencingTokenService("custom-node");
  assert.equal(service.getNodeId(), "custom-node");
});

test("FencingTokenService default node ID is 'default-node'", () => {
  const service = new FencingTokenService();
  assert.equal(service.getNodeId(), "default-node");
});

test("FencingTokenService clearAllFences removes all fences", () => {
  const service = new FencingTokenService("node1");
  service.acquireFence("exec1", "exclusive");
  service.acquireFence("exec2", "exclusive");
  assert.equal(service.getActiveFenceCount(), 2);
  service.clearAllFences();
  assert.equal(service.getActiveFenceCount(), 0);
});

test("FencingTokenService getActiveFenceCount returns correct count", () => {
  const service = new FencingTokenService("node1");
  assert.equal(service.getActiveFenceCount(), 0);
  service.acquireFence("exec1", "exclusive");
  assert.equal(service.getActiveFenceCount(), 1);
  service.acquireFence("exec2", "exclusive");
  assert.equal(service.getActiveFenceCount(), 2);
});
function createService() {
  return createInMemoryCasService();
}
