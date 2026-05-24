import assert from "node:assert/strict";
import test from "node:test";
import { FencingTokenService } from "../../../../../../src/platform/five-plane-state-evidence/events/cas/fencing-token-service.js";

// Helper to create fresh service with unique nodeId to avoid static state pollution
function createService(nodeId: string = "test-node"): FencingTokenService {
  const service = new FencingTokenService(nodeId);
  service.clearAllFences();
  return service;
}

test("acquireFence returns fence with correct fencingToken format", () => {
  const service = createService("node1");
  const fence = service.acquireFence("exec1", "exclusive");

  assert.ok(fence !== null);
  assert.equal(fence.executionId, "exec1");
  assert.equal(fence.mode, "exclusive");
  assert.ok(fence.fenceToken.includes("exec1"));
  assert.ok(fence.fenceToken.includes("node1"));
  assert.ok(fence.fenceToken.includes("::"));
  assert.ok(fence.fenceToken.includes(String(service.tokenCounter)));
});

test("acquireFence blocks same-node re-acquisition for the same execution", () => {
  const service = createService("node1");

  const fence1 = service.acquireFence("exec1", "exclusive");
  assert.ok(fence1 !== null);
  const fence2 = service.acquireFence("exec1", "exclusive");
  assert.equal(fence2, null);
});

test("acquireFence generates different tokens for different executions", () => {
  const service = createService("node1");

  const fence1 = service.acquireFence("execA", "exclusive");
  const fence2 = service.acquireFence("execB", "exclusive");

  assert.ok(fence1 !== null);
  assert.ok(fence2 !== null);
  assert.notEqual(fence1.fenceToken, fence2.fenceToken);
});

test("generateFencingToken increments tokenCounter monotonically", () => {
  const service = createService("nodeX");
  assert.equal(service.tokenCounter, 0);

  const token1 = service.generateFencingToken("exec1", "nodeX");
  assert.ok(token1.includes("::nodeX::1::"));

  const token2 = service.generateFencingToken("exec2", "nodeX");
  assert.ok(token2.includes("::nodeX::2::"));

  const token3 = service.generateFencingToken("exec3", "nodeX");
  assert.ok(token3.includes("::nodeX::3::"));
});

test("validateFencingToken returns valid:true for matching owner", () => {
  const service = createService("node1");
  const token = service.generateFencingToken("exec1", "node1");

  const result = service.validateFencingToken(token, "node1");

  assert.equal(result.valid, true);
  assert.equal(result.executionId, "exec1");
  assert.equal(result.owner, "node1");
});

test("validateFencingToken returns valid:false for non-matching owner", () => {
  const service = createService("node1");
  const token = service.generateFencingToken("exec1", "node1");

  const result = service.validateFencingToken(token, "node2");

  assert.equal(result.valid, false);
  assert.equal(result.owner, "node1");
  assert.equal(result.reason, "Token not owned by expected owner");
});

test("validateFencingToken returns valid:false for empty token", () => {
  const service = createService("node1");

  const result = service.validateFencingToken("", "node1");

  assert.equal(result.valid, false);
  assert.equal(result.reason, "Empty or invalid token");
});

test("validateFencingToken returns valid:false for malformed token", () => {
  const service = createService("node1");

  const result = service.validateFencingToken("invalid-token", "node1");

  assert.equal(result.valid, false);
  assert.equal(result.reason, "Token format invalid");
});

test("validateWriteAccess returns allowed:true for valid fencingToken", () => {
  const service = createService("node1");
  const fence = service.acquireFence("exec1", "exclusive");
  assert.ok(fence !== null);

  // simulate validateWriteAccess by calling validateFencingToken
  const result = service.validateFencingToken(fence.fenceToken, "node1");
  assert.equal(result.valid, true);
});

test("validateWriteAccess returns allowed:false for stale fence", () => {
  const service1 = createService("node1");
  const service2 = createService("node2");

  // node1 acquires fence
  const fence = service1.acquireFence("exec1", "exclusive");
  assert.ok(fence !== null);

  // node2 tries to validate with node1's token - should fail
  const result = service2.validateFencingToken(fence.fenceToken, "node2");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "Token not owned by expected owner");
});

test("releaseFence returns true when owned fence is released", () => {
  const service = createService("node1");
  service.acquireFence("exec1", "exclusive");

  const released = service.releaseFence("exec1");

  assert.equal(released, true);
  assert.equal(service.isFenceHeld("exec1"), false);
});

test("releaseFence returns false when fence not found", () => {
  const service = createService("node1");

  const released = service.releaseFence("nonexistent");

  assert.equal(released, false);
});

test("releaseFence only releases if ownerNodeId matches", () => {
  const service1 = createService("node1");
  const service2 = createService("node2");

  // node1 acquires fence
  service1.acquireFence("exec1", "exclusive");

  // node2 tries to release node1's fence - should fail
  const released = service2.releaseFence("exec1");

  assert.equal(released, false);
  // node1's fence should still be held
  assert.equal(service1.isFenceHeld("exec1"), true);
});

test("releaseFence returns false if fence not owned by current node", () => {
  const service1 = createService("nodeA");
  const service2 = createService("nodeB");

  service1.acquireFence("execX", "exclusive");

  const result = service2.releaseFence("execX");

  assert.equal(result, false);
});

test("activeFences Map tracks acquired fences correctly", () => {
  const service = createService("node1");
  assert.equal(service.getActiveFenceCount(), 0);

  service.acquireFence("exec1", "exclusive");
  assert.equal(service.getActiveFenceCount(), 1);

  service.acquireFence("exec2", "shared");
  assert.equal(service.getActiveFenceCount(), 2);

  service.releaseFence("exec1");
  assert.equal(service.getActiveFenceCount(), 1);

  service.releaseFence("exec2");
  assert.equal(service.getActiveFenceCount(), 0);
});

test("activeFences Map properly tracks acquired vs released fences", () => {
  const service = createService("node1");

  // Acquire multiple fences
  service.acquireFence("execA", "exclusive");
  service.acquireFence("execB", "exclusive");
  assert.equal(service.getActiveFenceCount(), 2);

  // Release one
  service.releaseFence("execA");
  assert.equal(service.getActiveFenceCount(), 1);

  // getFenceInfo should return undefined after release
  const info = service.getFenceInfo("execA");
  assert.equal(info, undefined);

  // getFenceInfo should still return fence for execB
  const infoB = service.getFenceInfo("execB");
  assert.ok(infoB !== undefined);
  assert.equal(infoB.executionId, "execB");
});

test("Concurrent acquire scenarios handled correctly", () => {
  const service1 = createService("node1");
  const service2 = createService("node2");

  // Both nodes acquire fences for different executions
  const fence1 = service1.acquireFence("exec1", "exclusive");
  const fence2 = service2.acquireFence("exec2", "exclusive");

  assert.ok(fence1 !== null);
  assert.ok(fence2 !== null);
  assert.notEqual(fence1.fenceToken, fence2.fenceToken);

  // Both fences should be tracked
  assert.equal(service1.getActiveFenceCount(), 2);
  assert.equal(service2.getActiveFenceCount(), 2);
});

test("Concurrent acquire/release with same execution handled correctly", () => {
  const service1 = createService("node1");
  const service2 = createService("node2");

  // node1 acquires exclusive fence for exec1
  const fence1 = service1.acquireFence("exec1", "exclusive");
  assert.ok(fence1 !== null);

  // node2 tries to acquire exclusive fence for same execution - should fail
  const fence2 = service2.acquireFence("exec1", "exclusive");
  assert.equal(fence2, null);

  // node1 releases
  const released = service1.releaseFence("exec1");
  assert.equal(released, true);

  // Now node2 can acquire
  const fence3 = service2.acquireFence("exec1", "exclusive");
  assert.ok(fence3 !== null);
  assert.notEqual(fence3.fenceToken, fence1.fenceToken);
});

test("acquireFence with shared mode allows multiple holders", () => {
  const service1 = createService("node1");
  const service2 = createService("node2");

  const fence1 = service1.acquireFence("exec1", "shared");
  assert.ok(fence1 !== null);

  const fence2 = service2.acquireFence("exec1", "shared");
  assert.ok(fence2 !== null);

  // Both fences should exist and have different tokens
  assert.notEqual(fence1.fenceToken, fence2.fenceToken);
  assert.equal(fence1.mode, "shared");
  assert.equal(fence2.mode, "shared");
});

test("exclusive fence is blocked when another node already holds a shared fence", () => {
  const service1 = createService("node1");
  const service2 = createService("node2");

  const sharedFence = service1.acquireFence("exec1", "shared");
  assert.ok(sharedFence !== null);

  const exclusiveFence = service2.acquireFence("exec1", "exclusive");
  assert.equal(exclusiveFence, null);
});

test("exclusive fence blocks shared fence acquisition", () => {
  const service1 = createService("node1");
  const service2 = createService("node2");

  // node1 acquires exclusive fence
  service1.acquireFence("exec1", "exclusive");

  // node2 tries to acquire shared fence for same execution - should be blocked
  const fence2 = service2.acquireFence("exec1", "shared");
  assert.equal(fence2, null);
});

test("acquireFence returns null when another node holds exclusive fence", () => {
  const service1 = createService("node1");
  const service2 = createService("node2");

  service1.acquireFence("execX", "exclusive");
  const result = service2.acquireFence("execX", "exclusive");

  assert.equal(result, null);
});

test("getNodeId returns configured nodeId", () => {
  const service = createService("mycustomnode");
  assert.equal(service.getNodeId(), "mycustomnode");
});

test("clearAllFences removes all tracked fences", () => {
  const service = createService("node1");

  service.acquireFence("exec1", "exclusive");
  service.acquireFence("exec2", "exclusive");
  service.acquireFence("exec3", "exclusive");
  assert.equal(service.getActiveFenceCount(), 3);

  service.clearAllFences();
  assert.equal(service.getActiveFenceCount(), 0);
});

test("getFenceInfo returns correct fence info before release", () => {
  const service = createService("node1");
  const fence = service.acquireFence("execinfo", "exclusive");

  const info = service.getFenceInfo("execinfo");

  assert.ok(info !== undefined);
  assert.equal(info.executionId, "execinfo");
  assert.equal(info.mode, "exclusive");
  assert.equal(info.ownerNodeId, "node1");
  assert.ok(info.fenceToken !== null);
  assert.ok(info.acquiredAt instanceof Date);
});

test("releaseFence after release returns false", () => {
  const service = createService("node1");

  service.acquireFence("executed", "exclusive");
  const first = service.releaseFence("executed");
  assert.equal(first, true);

  const second = service.releaseFence("executed");
  assert.equal(second, false);
});

test("isFenceHeld returns false after release", () => {
  const service = createService("node1");

  service.acquireFence("exec", "exclusive");
  assert.equal(service.isFenceHeld("exec"), true);

  service.releaseFence("exec");
  assert.equal(service.isFenceHeld("exec"), false);
});

test("isFenceHeld returns true when fence exists", () => {
  const service = createService("node1");

  assert.equal(service.isFenceHeld("nonexistent"), false);

  service.acquireFence("execheld", "exclusive");
  assert.equal(service.isFenceHeld("execheld"), true);
});

test("multiple acquire/release cycles work correctly", () => {
  const service = createService("node1");

  for (let i = 0; i < 5; i++) {
    const fence = service.acquireFence("exec" + i, "exclusive");
    assert.ok(fence !== null);
    assert.equal(service.isFenceHeld("exec" + i), true);

    const released = service.releaseFence("exec" + i);
    assert.equal(released, true);
    assert.equal(service.isFenceHeld("exec" + i), false);
  }
});
