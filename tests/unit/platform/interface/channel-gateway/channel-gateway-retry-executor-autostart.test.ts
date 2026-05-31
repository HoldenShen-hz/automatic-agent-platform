/**
 * Unit tests for ChannelGatewayRetryExecutor autoStart behavior
 * Tests the autoStart option and immediate polling behavior
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ChannelGatewayRetryExecutor } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-retry-executor.js";

function createMockGatewayService(processResult: any = { scanned: 0, delivered: 0, retryScheduled: 0, deadLettered: 0, skippedRateLimited: 0 }) {
  return {
    processRetryQueue: async (batchSize: number) => {
      return processResult;
    },
  };
}

test("ChannelGatewayRetryExecutor with autoStart begins polling immediately", () => {
  assert.doesNotThrow(() => {
    const mockService = createMockGatewayService();
    // autoStart should call runOnce() and start() during construction
    const executor = new ChannelGatewayRetryExecutor(mockService as any, {
      pollIntervalMs: 60000,
      autoStart: true,
    });

    // The executor should be running - verify stop cleans up
    executor.stop();
  });
});

test("ChannelGatewayRetryExecutor autoStart does not block constructor", () => {
  const mockService = createMockGatewayService();
  // Should not throw - constructor should return quickly
  const executor = new ChannelGatewayRetryExecutor(mockService as any, {
    pollIntervalMs: 60000,
    autoStart: true,
  });

  assert.ok(executor);
  executor.stop();
});

test("ChannelGatewayRetryExecutor autoStart with custom batchSize", () => {
  const mockService = createMockGatewayService({ scanned: 10, delivered: 5, retryScheduled: 3, deadLettered: 1, skippedRateLimited: 1 });
  const executor = new ChannelGatewayRetryExecutor(mockService as any, {
    pollIntervalMs: 60000,
    autoStart: true,
    batchSize: 50,
  });

  assert.ok(executor);
  executor.stop();
});

test("ChannelGatewayRetryExecutor autoStart and stop can be called multiple times", () => {
  assert.doesNotThrow(() => {
    const mockService = createMockGatewayService();
    const executor = new ChannelGatewayRetryExecutor(mockService as any, {
      pollIntervalMs: 60000,
      autoStart: true,
    });

    // Multiple stops should be safe
    executor.stop();
    executor.stop();
    executor.stop();
  });
});

test("ChannelGatewayRetryExecutor runOnce returns completedAt after startedAt", async () => {
  const mockService = createMockGatewayService();
  const executor = new ChannelGatewayRetryExecutor(mockService as any);

  const result = await executor.runOnce();

  assert.ok(result.completedAt >= result.startedAt);
  executor.stop();
});

test("ChannelGatewayRetryExecutor runOnce includes gateway service result properties", async () => {
  const mockService = createMockGatewayService({
    scanned: 10,
    delivered: 8,
    retryScheduled: 1,
    deadLettered: 0,
    skippedRateLimited: 1,
  });
  const executor = new ChannelGatewayRetryExecutor(mockService as any);

  const result = await executor.runOnce();

  assert.equal(result.scanned, 10);
  assert.equal(result.delivered, 8);
  assert.equal(result.retryScheduled, 1);
  assert.equal(result.deadLettered, 0);
  assert.equal(result.skippedRateLimited, 1);
  executor.stop();
});

test("ChannelGatewayRetryExecutor runOnce busy flag prevents concurrent execution", async () => {
  let resolveCount = 0;
  const mockService = createMockGatewayService();
  mockService.processRetryQueue = async () => {
    resolveCount++;
    if (resolveCount === 1) {
      // First call - block
      await new Promise((r) => setTimeout(r, 100));
    }
    return { scanned: 1, delivered: 1, retryScheduled: 0, deadLettered: 0, skippedRateLimited: 0 };
  };

  const executor = new ChannelGatewayRetryExecutor(mockService as any, { pollIntervalMs: 60000 });

  // First call
  const p1 = executor.runOnce();
  // Second call immediately - should be busy
  const result2 = await executor.runOnce();

  assert.equal(result2.busy, true);

  await p1;
  executor.stop();
});

test("ChannelGatewayRetryExecutor runOnce on error returns zeroed result", async () => {
  const mockService = createMockGatewayService();
  mockService.processRetryQueue = async () => {
    throw new Error("Connection refused");
  };

  const executor = new ChannelGatewayRetryExecutor(mockService as any);
  const result = await executor.runOnce();

  assert.equal(result.scanned, 0);
  assert.equal(result.delivered, 0);
  assert.equal(result.retryScheduled, 0);
  assert.equal(result.deadLettered, 0);
  assert.equal(result.skippedRateLimited, 0);
  assert.equal(result.busy, false);
  executor.stop();
});

test("ChannelGatewayRetryExecutor runOnce on error includes timestamps", async () => {
  const mockService = createMockGatewayService();
  mockService.processRetryQueue = async () => {
    throw new Error("Timeout");
  };

  const executor = new ChannelGatewayRetryExecutor(mockService as any);
  const result = await executor.runOnce();

  assert.ok(result.startedAt);
  assert.ok(result.completedAt);
  assert.ok(result.completedAt >= result.startedAt);
  executor.stop();
});
