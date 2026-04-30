import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for FencingTokenService covering:
 * - Issue #2026: Fencing token parsed by '-', UUID executionId with hyphen split wrongly
 */

import { FencingTokenService } from "../../../../../../src/platform/state-evidence/events/cas/fencing-token-service.js";

test.beforeEach(() => {
  const service = new FencingTokenService("test-node");
  service.clearAllFences();
});

test("FencingTokenService.parseUUIDWithHyphen - Issue #2026: handles UUID format execution IDs", () => {
  const service = new FencingTokenService("test-node");

  // Generate token with a UUID-like execution ID
  const uuidExecutionId = "550e8400-e29b-41d4-a716-446655440000";
  const token = service.generateFencingToken(uuidExecutionId, "test-node");

  // Validate should correctly parse UUID with hyphens
  const result = service.validateFencingToken(token, "test-node");

  assert.equal(result.valid, true, "UUID execution ID should parse correctly");
  assert.equal(result.executionId, uuidExecutionId, "executionId should match UUID");
  assert.equal(result.owner, "test-node");
});

test("FencingTokenService handles executionId with multiple hyphens", () => {
  const service = new FencingTokenService("node1");

  // Execution ID with multiple hyphenated segments
  const executionId = "exec-123-456-789-abc-def";
  const token = service.generateFencingToken(executionId, "node1");

  const result = service.validateFencingToken(token, "node1");

  assert.equal(result.valid, true, "multi-hyphen execution ID should parse correctly");
  assert.equal(result.executionId, executionId, "full executionId should be preserved");
});

test("FencingTokenService.validateFencingToken rejects malformed tokens", () => {
  const service = new FencingTokenService("test-node");

  // Too few parts (only 3, needs 4)
  const malformedToken = "exec::node::counter"; // missing timestamp part
  const result = service.validateFencingToken(malformedToken, "test-node");

  assert.equal(result.valid, false);
  assert.equal(result.reason, "Token format invalid");
});

test("FencingTokenService.validateFencingToken handles empty executionId part", () => {
  const service = new FencingTokenService("node1");

  // Create token with empty executionId component
  const malformedToken = "::node1::1::1234567890";
  const result = service.validateFencingToken(malformedToken, "node1");

  assert.equal(result.valid, false);
  assert.equal(result.reason, "Token format invalid");
});

test("FencingTokenService.generateFencingToken uses :: separator not -", () => {
  const service = new FencingTokenService("node1");

  const token = service.generateFencingToken("exec-123", "node1");

  // Token should use :: separator (not -)
  const parts = token.split("::");
  assert.equal(parts.length, 4, "Token should have 4 parts separated by ::");

  // Verify the parts are correctly encoded
  assert.equal(parts[0], "exec-123", "executionId part should be preserved");
  assert.equal(parts[1], "node1", "nodeId part should be preserved");
  assert.ok(Number.isInteger(Number(parts[2])), "counter should be numeric");
  assert.ok(Number.isInteger(Number(parts[3])), "timestamp should be numeric");
});

test("FencingTokenService.validateFencingToken rejects token with wrong owner", () => {
  const service = new FencingTokenService("node1");

  const token = service.generateFencingToken("exec123", "node1");
  const result = service.validateFencingToken(token, "different-node");

  assert.equal(result.valid, false);
  assert.equal(result.owner, "node1");
  assert.equal(result.reason, "Token not owned by expected owner");
});

test("FencingTokenService.acquireFence and releaseFence work with hyphenated executionId", () => {
  const service = new FencingTokenService("test-node");
  const execId = "execution-123-456";

  // Acquire fence
  const fence = service.acquireFence(execId, "exclusive");
  assert.ok(fence !== null, "should acquire fence");
  assert.equal(fence.executionId, execId);
  assert.equal(fence.mode, "exclusive");

  // Check fence is held
  assert.equal(service.isFenceHeld(execId), true);

  // Release fence
  const released = service.releaseFence(execId);
  assert.equal(released, true);

  // Check fence is released
  assert.equal(service.isFenceHeld(execId), false);
});

test("FencingTokenService.acquireFence exclusive blocks other nodes", () => {
  const service1 = new FencingTokenService("node1");
  const service2 = new FencingTokenService("node2");

  service1.clearAllFences();
  service2.clearAllFences();

  const execId = "shared-exec-789";

  // Node1 acquires exclusive fence
  const fence1 = service1.acquireFence(execId, "exclusive");
  assert.ok(fence1 !== null, "node1 should acquire fence");

  // Node2 cannot acquire exclusive fence for same execution
  const fence2 = service2.acquireFence(execId, "exclusive");
  assert.equal(fence2, null, "node2 should be blocked");

  // But node2 can acquire shared fence (if node1 had shared instead)
  service1.releaseFence(execId);
  const fence1Shared = service1.acquireFence(execId, "shared");
  assert.ok(fence1Shared !== null);

  const fence2Shared = service2.acquireFence(execId, "shared");
  // Multiple shared fences are allowed
  assert.ok(fence2Shared !== null, "shared fence should allow multiple holders");
});

test("FencingTokenService.getFenceInfo returns correct info", () => {
  const service = new FencingTokenService("my-node");
  service.clearAllFences();

  const execId = "exec-info-test";
  const fence = service.acquireFence(execId, "exclusive");
  assert.ok(fence !== null);

  const info = service.getFenceInfo(execId);
  assert.ok(info !== undefined, "should have fence info");
  assert.equal(info!.executionId, execId);
  assert.equal(info!.ownerNodeId, "my-node");
  assert.equal(info!.mode, "exclusive");
});

test("FencingTokenService.clearAllFences removes all fences", () => {
  const service = new FencingTokenService("test-node");

  service.acquireFence("exec1", "exclusive");
  service.acquireFence("exec2", "shared");

  assert.ok(service.getActiveFenceCount() > 0, "should have active fences");

  service.clearAllFences();

  assert.equal(service.getActiveFenceCount(), 0, "should have no active fences after clear");
});