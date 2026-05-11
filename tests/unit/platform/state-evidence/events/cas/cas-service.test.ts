import assert from "node:assert/strict";
import test from "node:test";

import { CasService } from "../../../../../../src/platform/state-evidence/events/cas/cas-service.js";
import {
  FencingTokenService,
  type FenceMode,
} from "../../../../../../src/platform/state-evidence/events/cas/fencing-token-service.js";

// Clear static fences before/after each test to avoid state pollution
test.beforeEach(() => {
  const service = new FencingTokenService();
  service.clearAllFences();
});

test.afterEach(() => {
  const service = new FencingTokenService();
  service.clearAllFences();
});

// =============================================================================
// CAS Service Tests
// =============================================================================

test("CasService.compareAndSwap succeeds when value matches expected", () => {
  const service = new CasService();

  // Set initial value
  service.setValue("key1", "initial");

  // CAS should succeed when value matches
  const result = service.compareAndSwap("key1", "initial", "updated");

  assert.equal(result.success, true);
  assert.equal(result.currentValue, "updated");
  assert.equal(result.currentVersion, 2);
});

test("CasService.compareAndSwap fails when value doesn't match", () => {
  const service = new CasService();

  // Set initial value
  service.setValue("key1", "initial");

  // CAS should fail when value doesn't match
  const result = service.compareAndSwap("key1", "wrong_expected", "updated");

  assert.equal(result.success, false);
  assert.equal(result.currentValue, "initial");
  assert.equal(result.currentVersion, 1);
});

test("CasService.compareAndSwap succeeds when key doesn't exist and expected is empty", () => {
  const service = new CasService();

  // CAS should succeed if key doesn't exist and expected is empty
  const result = service.compareAndSwap("nonexistent", "", "new_value");

  assert.equal(result.success, true);
  assert.equal(result.currentValue, "new_value");
  assert.equal(result.currentVersion, 1);
});

test("CasService.compareAndSwap fails when key doesn't exist and expected is not empty", () => {
  const service = new CasService();

  // CAS should fail if key doesn't exist and expected is not empty
  const result = service.compareAndSwap("nonexistent", "some_value", "new_value");

  assert.equal(result.success, false);
  assert.equal(result.currentValue, undefined);
  assert.equal(result.currentVersion, undefined);
});

test("CasService.compareAndSet succeeds when version matches expected", () => {
  const service = new CasService();

  // Set initial value with version 1
  service.setValue("key1", "initial");

  // CAS should succeed when version matches
  const result = service.compareAndSet("key1", 1, "updated");

  assert.equal(result.success, true);
  assert.equal(result.currentValue, "updated");
  assert.equal(result.currentVersion, 2);
});

test("CasService.compareAndSet fails when version doesn't match", () => {
  const service = new CasService();

  // Set initial value with version 1
  service.setValue("key1", "initial");

  // CAS should fail when version doesn't match
  const result = service.compareAndSet("key1", 99, "updated");

  assert.equal(result.success, false);
  assert.equal(result.currentValue, "initial");
  assert.equal(result.currentVersion, 1);
});

test("CasService.compareAndSet succeeds on new key with version 0", () => {
  const service = new CasService();

  // CAS should succeed on new key with expected version 0
  const result = service.compareAndSet("newkey", 0, "value");

  assert.equal(result.success, true);
  assert.equal(result.currentValue, "value");
  assert.equal(result.currentVersion, 1);
});

test("CasService.compareAndSet fails on new key with non-zero version", () => {
  const service = new CasService();

  // CAS should fail on new key if expected version is not 0
  const result = service.compareAndSet("newkey", 1, "value");

  assert.equal(result.success, false);
  assert.equal(result.currentValue, undefined);
  assert.equal(result.currentVersion, undefined);
});

test("CasService version increments on successful CAS", () => {
  const service = new CasService();

  // Set initial value
  service.setValue("key1", "initial");
  assert.equal(service.getVersion("key1"), 1);

  // First CAS
  service.compareAndSwap("key1", "initial", "v1");
  assert.equal(service.getVersion("key1"), 2);

  // Second CAS
  service.compareAndSwap("key1", "v1", "v2");
  assert.equal(service.getVersion("key1"), 3);

  // Third CAS
  service.compareAndSet("key1", 3, "v3");
  assert.equal(service.getVersion("key1"), 4);
});

test("CasService.getValue returns current value", () => {
  const service = new CasService();

  assert.equal(service.getValue("nonexistent"), undefined);

  service.setValue("key1", "value1");
  assert.equal(service.getValue("key1"), "value1");

  service.compareAndSwap("key1", "value1", "value2");
  assert.equal(service.getValue("key1"), "value2");
});

test("CasService.getVersion returns current version", () => {
  const service = new CasService();

  assert.equal(service.getVersion("nonexistent"), undefined);

  service.setValue("key1", "value1");
  assert.equal(service.getVersion("key1"), 1);
});

test("CasService.has returns true for existing keys", () => {
  const service = new CasService();

  assert.equal(service.has("key1"), false);

  service.setValue("key1", "value1");
  assert.equal(service.has("key1"), true);
});

test("CasService.delete removes key", () => {
  const service = new CasService();

  service.setValue("key1", "value1");
  assert.equal(service.has("key1"), true);

  const deleted = service.delete("key1");
  assert.equal(deleted, true);
  assert.equal(service.has("key1"), false);
});

test("CasService.delete returns false for nonexistent key", () => {
  const service = new CasService();

  const deleted = service.delete("nonexistent");
  assert.equal(deleted, false);
});

// =============================================================================
// Fencing Token Service Tests
// =============================================================================

test("FencingTokenService generates unique fencing tokens", () => {
  const service = new FencingTokenService("node1");

  const token1 = service.generateFencingToken("exec1", "node1");
  const token2 = service.generateFencingToken("exec1", "node1");

  // Tokens should be different due to counter and timestamp
  assert.notEqual(token1, token2);
  assert.ok(token1.includes("exec1"));
  assert.ok(token1.includes("node1"));
});

test("FencingTokenService generates token with correct format", () => {
  const service = new FencingTokenService("node1");

  const token = service.generateFencingToken("exec123", "node1");

  const parts = token.split("::");
  assert.equal(parts.length, 4);
  assert.equal(decodeURIComponent(parts[0] ?? ""), "exec123");
  assert.equal(decodeURIComponent(parts[1] ?? ""), "node1");
});

test("FencingTokenService.validateFencingToken succeeds for correct owner", () => {
  const service = new FencingTokenService("node1");

  const token = service.generateFencingToken("exec1", "node1");
  const validation = service.validateFencingToken(token, "node1");

  assert.equal(validation.valid, true);
  assert.equal(validation.executionId, "exec1");
  assert.equal(validation.owner, "node1");
});

test("FencingTokenService.validateFencingToken fails for wrong owner", () => {
  const service = new FencingTokenService("node1");

  const token = service.generateFencingToken("exec1", "node1");
  const validation = service.validateFencingToken(token, "node2");

  assert.equal(validation.valid, false);
  assert.equal(validation.owner, "node1");
  assert.equal(validation.reason, "Token not owned by expected owner");
});

test("FencingTokenService.validateFencingToken fails for empty token", () => {
  const service = new FencingTokenService("node1");

  const validation = service.validateFencingToken("", "node1");

  assert.equal(validation.valid, false);
  assert.equal(validation.reason, "Empty or invalid token");
});

test("FencingTokenService.validateFencingToken fails for invalid token format", () => {
  const service = new FencingTokenService("node1");

  const validation = service.validateFencingToken("invalid-token", "node1");

  assert.equal(validation.valid, false);
  assert.equal(validation.reason, "Token format invalid");
});

test("FencingTokenService.acquireFence acquires exclusive fence", () => {
  const service = new FencingTokenService("node1");

  const fence = service.acquireFence("exec1", "exclusive");

  assert.ok(fence !== null);
  assert.equal(fence?.executionId, "exec1");
  assert.equal(fence?.mode, "exclusive");
  assert.ok(fence?.fenceToken.includes("exec1"));
});

test("FencingTokenService.acquireFence acquires shared fence", () => {
  const service = new FencingTokenService("node1");

  const fence = service.acquireFence("exec1", "shared");

  assert.ok(fence !== null);
  assert.equal(fence?.executionId, "exec1");
  assert.equal(fence?.mode, "shared");
});

test("FencingTokenService.acquireFence blocks same-node shared fence re-acquisition", () => {
  const service = new FencingTokenService("node1");

  const fence1 = service.acquireFence("exec1", "shared");
  const fence2 = service.acquireFence("exec1", "shared");

  assert.ok(fence1 !== null);
  assert.equal(fence2, null);
});

test("FencingTokenService.acquireFence blocks exclusive when already held by different node", () => {
  const service1 = new FencingTokenService("node1");
  const service2 = new FencingTokenService("node2");
  service1.clearAllFences();

  const fence1 = service1.acquireFence("exec1", "exclusive");
  assert.ok(fence1 !== null);
  assert.ok(service1.isFenceHeld("exec1"));

  const fence2 = service2.acquireFence("exec1", "exclusive");
  assert.equal(fence2, null);
});

test("FencingTokenService.acquireFence blocks same node from re-acquiring exclusive", () => {
  const service = new FencingTokenService("node1");
  service.clearAllFences();

  const fence1 = service.acquireFence("exec1", "exclusive");
  const fence2 = service.acquireFence("exec1", "exclusive");

  assert.ok(fence1 !== null);
  assert.equal(fence2, null);
});

test("FencingTokenService.releaseFence releases fence", () => {
  const service = new FencingTokenService("node1");

  service.acquireFence("exec1", "exclusive");
  assert.equal(service.isFenceHeld("exec1"), true);

  const released = service.releaseFence("exec1");
  assert.equal(released, true);
  assert.equal(service.isFenceHeld("exec1"), false);
});

test("FencingTokenService.releaseFence returns false when no fence held", () => {
  const service = new FencingTokenService("node1");

  const released = service.releaseFence("nonexistent");
  assert.equal(released, false);
});

test("FencingTokenService.isFenceHeld returns correct status", () => {
  const service = new FencingTokenService("node1");

  assert.equal(service.isFenceHeld("exec1"), false);

  service.acquireFence("exec1", "exclusive");
  assert.equal(service.isFenceHeld("exec1"), true);

  service.releaseFence("exec1");
  assert.equal(service.isFenceHeld("exec1"), false);
});

test("FencingTokenService.getFenceInfo returns fence info", () => {
  const service = new FencingTokenService("node1");

  const acquired = service.acquireFence("exec1", "exclusive");
  const info = service.getFenceInfo("exec1");

  assert.ok(info !== undefined);
  assert.equal(info?.executionId, "exec1");
  assert.equal(info?.mode, "exclusive");
  assert.equal(info?.ownerNodeId, "node1");
});

test("FencingTokenService.getNodeId returns configured node ID", () => {
  const service = new FencingTokenService("my-node");

  assert.equal(service.getNodeId(), "my-node");
});

test("FencingTokenService.clearAllFences clears all fences", () => {
  const service = new FencingTokenService("node1");

  service.acquireFence("exec1", "exclusive");
  service.acquireFence("exec2", "shared");

  assert.ok(service.getActiveFenceCount() > 0);

  service.clearAllFences();

  assert.equal(service.getActiveFenceCount(), 0);
  assert.equal(service.isFenceHeld("exec1"), false);
  assert.equal(service.isFenceHeld("exec2"), false);
});

test("FencingTokenService exclusive fence blocks shared fence from different node", () => {
  const service1 = new FencingTokenService("node1");
  const service2 = new FencingTokenService("node2");
  service1.clearAllFences();

  const fence1 = service1.acquireFence("exec1", "exclusive");
  assert.ok(fence1 !== null);

  const fence2 = service2.acquireFence("exec1", "shared");
  assert.equal(fence2, null);
});

test("FencingTokenService shares a monotonic counter across service instances", () => {
  const service1 = new FencingTokenService("node1");
  service1.clearAllFences();
  const service2 = new FencingTokenService("node2");

  const token1 = service1.generateFencingToken("exec1", "node1");
  const token2 = service2.generateFencingToken("exec2", "node2");

  assert.ok(token1.endsWith("::1::" + token1.split("::").at(-1)));
  assert.ok(token2.endsWith("::2::" + token2.split("::").at(-1)));
});

test("FencingTokenService getActiveFenceCount returns correct count", () => {
  const service = new FencingTokenService("node1");

  assert.equal(service.getActiveFenceCount(), 0);

  service.acquireFence("exec1", "exclusive");
  assert.equal(service.getActiveFenceCount(), 1);

  service.acquireFence("exec2", "shared");
  assert.equal(service.getActiveFenceCount(), 2);

  service.releaseFence("exec1");
  assert.equal(service.getActiveFenceCount(), 1);
});

// =============================================================================
// Concurrent CAS Operation Tests
// =============================================================================

test("CasService compareAndSwap is atomic under concurrent read-check-write", async () => {
  const service = new CasService();

  // Initialize with a known value
  service.setValue("concurrent-key", "initial");

  // Simulate concurrent CAS operations that all try to update from "initial"
  // Only one should succeed
  const results: Array<{ success: boolean; currentValue?: string }> = [];
  const operations = [];

  for (let i = 0; i < 10; i++) {
    operations.push(
      new Promise<void>((resolve) => {
        const result = service.compareAndSwap("concurrent-key", "initial", `updated-${i}`);
        results.push(result);
        resolve();
      }),
    );
  }

  await Promise.all(operations);

  // Exactly one should succeed
  const successCount = results.filter((r) => r.success).length;
  assert.equal(successCount, 1, `Expected exactly 1 success, got ${successCount}`);

  // The failed ones should see the updated value
  const failedResults = results.filter((r) => !r.success);
  for (const failed of failedResults) {
    assert.ok(
      failed.currentValue !== undefined && !failed.currentValue.startsWith("initial"),
      `Failed CAS should see non-initial value, got: ${failed.currentValue}`,
    );
  }
});

test("CasService compareAndSet is atomic under concurrent version-based updates", async () => {
  const service = new CasService();

  // Initialize with version 1
  service.setValue("version-key", "value1");

  // All 10 operations try to CAS from version 1 to different values
  const results: Array<{ success: boolean; currentVersion?: number }> = [];
  const operations = [];

  for (let i = 0; i < 10; i++) {
    operations.push(
      new Promise<void>((resolve) => {
        const result = service.compareAndSet("version-key", 1, `value-${i}`);
        results.push(result);
        resolve();
      }),
    );
  }

  await Promise.all(operations);

  // Exactly one should succeed (the first one to acquire the lock)
  const successCount = results.filter((r) => r.success).length;
  assert.equal(successCount, 1, `Expected exactly 1 success, got ${successCount}`);

  // Version should be 2 for the successful one
  const successfulResult = results.find((r) => r.success);
  assert.equal(successfulResult?.currentVersion, 2);
});

test("CasService handles rapid alternating CAS operations", () => {
  const service = new CasService();

  service.setValue("alternating-key", "A");

  // Rapidly alternate between two values
  for (let i = 0; i < 100; i++) {
    const currentValue = service.getValue("alternating-key");
    if (currentValue === "A") {
      const result = service.compareAndSwap("alternating-key", "A", "B");
      assert.equal(result.success, true);
    } else {
      const result = service.compareAndSwap("alternating-key", "B", "A");
      assert.equal(result.success, true);
    }
  }

  // Final version should be 101 (1 initial + 100 updates)
  assert.equal(service.getVersion("alternating-key"), 101);
});

test("CasService lock prevents interleaved read-check-write", () => {
  const service = new CasService();

  service.setValue("interleave-key", "initial");

  let operationOrder: string[] = [];
  const releaseOrder: string[] = [];

  // Simulate interleaving operations
  const op1 = () => {
    operationOrder.push("op1-read-start");
    const current = service.getValue("interleave-key");
    operationOrder.push("op1-read-end");
    operationOrder.push("op1-write-start");
    // This should block until op2 completes its write
    const result = service.compareAndSwap("interleave-key", current, "op1-value");
    operationOrder.push("op1-write-end");
    releaseOrder.push(result.success ? "op1-success" : "op1-fail");
  };

  const op2 = () => {
    operationOrder.push("op2-read-start");
    const current = service.getValue("interleave-key");
    operationOrder.push("op2-read-end");
    operationOrder.push("op2-write-start");
    const result = service.compareAndSwap("interleave-key", current, "op2-value");
    operationOrder.push("op2-write-end");
    releaseOrder.push(result.success ? "op2-success" : "op2-fail");
  };

  // Run synchronously to verify atomicity
  op1();
  op2();

  // One should succeed, one should fail
  const successCount = releaseOrder.filter((r) => r.includes("success")).length;
  assert.equal(successCount, 1);

  // Verify sequential execution (no interleaving of reads/writes)
  // If atomic, we should see full operation complete before other starts
  assert.ok(
    operationOrder.indexOf("op1-write-end") < operationOrder.indexOf("op2-write-start") ||
      operationOrder.indexOf("op2-write-end") < operationOrder.indexOf("op1-write-start"),
    "Operations should be atomic - no interleaving",
  );
});
