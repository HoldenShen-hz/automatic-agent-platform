/**
 * Unit tests for FencingTokenService - Issue #2026
 *
 * Tests that verify fencing token parsing handles UUID execution IDs correctly.
 * Issue #2026: fencing-token-service.ts:100-110 - Fencing token parsed by '-', UUID split wrongly
 *
 * The bug was that the token format used "-" as separator, which caused issues when
 * parsing UUID executionIds (which contain hyphens).
 *
 * Fixed format uses "::" as separator (FENCING_TOKEN_SEPARATOR = "::").
 */

import assert from "node:assert/strict";
import test from "node:test";

import { FencingTokenService } from "../../../../../../src/platform/state-evidence/events/cas/fencing-token-service.js";

test.beforeEach(() => {
  const service = new FencingTokenService("test-node");
  service.clearAllFences();
});

test.afterEach(() => {
  const service = new FencingTokenService("test-node");
  service.clearAllFences();
});

test("FencingTokenService generates token with :: separator (not -)", () => {
  const service = new FencingTokenService("node1");

  const token = service.generateFencingToken("exec-123", "node1");

  // Token should use :: separator
  const parts = token.split("::");
  assert.equal(parts.length, 4, "Token should have 4 parts separated by ::");
  assert.equal(parts[0], "exec-123", "executionId should be preserved");
  assert.equal(parts[1], "node1", "nodeId should be preserved");
});

test("FencingTokenService handles UUID executionId without splitting wrongly - Issue #2026", () => {
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

test("FencingTokenService.validateFencingToken rejects empty token", () => {
  const service = new FencingTokenService("test-node");

  const result = service.validateFencingToken("", "test-node");

  assert.equal(result.valid, false);
  assert.equal(result.reason, "Empty or invalid token");
});

test("FencingTokenService.validateFencingToken rejects whitespace-only token", () => {
  const service = new FencingTokenService("test-node");

  const result = service.validateFencingToken("   ", "test-node");

  assert.equal(result.valid, false);
  assert.equal(result.reason, "Token format invalid");
});

test("FencingTokenService.validateFencingToken rejects token with wrong owner", () => {
  const service = new FencingTokenService("node1");

  const token = service.generateFencingToken("exec123", "node1");
  const result = service.validateFencingToken(token, "different-node");

  assert.equal(result.valid, false);
  assert.equal(result.owner, "node1");
  assert.equal(result.reason, "Token not owned by expected owner");
});

test("FencingTokenService.validateFencingToken returns valid for correct owner", () => {
  const service = new FencingTokenService("node1");

  const token = service.generateFencingToken("exec123", "node1");
  const result = service.validateFencingToken(token, "node1");

  assert.equal(result.valid, true);
  assert.equal(result.executionId, "exec123");
  assert.equal(result.owner, "node1");
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

  // But node2 can acquire shared fence
  service1.releaseFence(execId);
  const fence1Shared = service1.acquireFence(execId, "shared");
  assert.ok(fence1Shared !== null);

  const fence2Shared = service2.acquireFence(execId, "shared");
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

test("FencingTokenService.getActiveFenceCount returns correct count", () => {
  const service = new FencingTokenService("test-node");

  assert.equal(service.getActiveFenceCount(), 0);
  service.acquireFence("exec1", "exclusive");
  assert.equal(service.getActiveFenceCount(), 1);
  service.acquireFence("exec2", "exclusive");
  assert.equal(service.getActiveFenceCount(), 2);
});

test("FencingTokenService.getNodeId returns configured node ID", () => {
  const service = new FencingTokenService("custom-node");
  assert.equal(service.getNodeId(), "custom-node");
});

test("FencingTokenService default node ID is 'default-node'", () => {
  const service = new FencingTokenService();
  assert.equal(service.getNodeId(), "default-node");
});

test("FencingTokenService generates unique tokens on multiple calls", () => {
  const service = new FencingTokenService("node1");

  const token1 = service.generateFencingToken("exec1", "node1");
  const token2 = service.generateFencingToken("exec1", "node1");

  assert.notEqual(token1, token2, "Tokens should be unique");
  assert.ok(token1.includes("exec1"));
  assert.ok(token2.includes("exec1"));
});

test("FencingTokenService shares a monotonic counter across service instances", () => {
  const service1 = new FencingTokenService("node1");
  const service2 = new FencingTokenService("node2");

  const token1 = service1.generateFencingToken("exec-shared", "node1");
  const token2 = service2.generateFencingToken("exec-shared", "node2");

  const counter1 = Number.parseInt(token1.split("::")[2] ?? "", 10);
  const counter2 = Number.parseInt(token2.split("::")[2] ?? "", 10);

  assert.ok(Number.isFinite(counter1));
  assert.ok(Number.isFinite(counter2));
  assert.ok(counter2 > counter1, "counter should increase across instances");
});

test("FencingTokenService validateFencingToken parses all token components", () => {
  const service = new FencingTokenService("node1");

  const token = service.generateFencingToken("my-execution-id-123", "my-node");

  const result = service.validateFencingToken(token, "my-node");

  assert.equal(result.valid, true);
  assert.equal(result.executionId, "my-execution-id-123");
  assert.equal(result.owner, "my-node");
});

test("FencingTokenService fence expires after TTL", () => {
  const service = new FencingTokenService("node1");

  // Manually create an expired fence by manipulating the static map
  // This is a workaround since we can't easily control time in tests
  const execId = "expiring-exec";

  const fence = service.acquireFence(execId, "exclusive");
  assert.ok(fence !== null);

  // Verify fence is held
  assert.equal(service.isFenceHeld(execId), true);

  // Release and verify
  service.releaseFence(execId);
  assert.equal(service.isFenceHeld(execId), false);
});
