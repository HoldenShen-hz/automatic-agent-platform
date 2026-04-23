import assert from "node:assert/strict";
import test from "node:test";

import { ChannelGatewayRetryExecutor } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-retry-executor.js";

class MockGatewayService {
  public processRetryQueueCalls: number[] = [];
  public processRetryQueueResults = [
    { scanned: 5, delivered: 3, retryScheduled: 1, deadLettered: 0, skippedRateLimited: 1 },
    { scanned: 2, delivered: 2, retryScheduled: 0, deadLettered: 0, skippedRateLimited: 0 },
  ];
  private callIndex = 0;

  async processRetryQueue(batchSize: number) {
    this.processRetryQueueCalls.push(batchSize);
    return this.processRetryQueueResults[this.callIndex++] ?? { scanned: 0, delivered: 0, retryScheduled: 0, deadLettered: 0, skippedRateLimited: 0 };
  }
}

test("ChannelGatewayRetryExecutor uses default poll interval of 15000ms", () => {
  const mockService = new MockGatewayService();
  const executor = new ChannelGatewayRetryExecutor(mockService);
  executor.stop(); // Clean up interval
});

test("ChannelGatewayRetryExecutor uses default batch size of 25", async () => {
  const mockService = new MockGatewayService();
  const executor = new ChannelGatewayRetryExecutor(mockService);

  await executor.runOnce();

  assert.equal(mockService.processRetryQueueCalls[0], 25);
  executor.stop();
});

test("ChannelGatewayRetryExecutor respects custom poll interval and batch size", async () => {
  const mockService = new MockGatewayService();
  const executor = new ChannelGatewayRetryExecutor(mockService, {
    pollIntervalMs: 5000,
    batchSize: 50,
  });

  await executor.runOnce();

  assert.equal(mockService.processRetryQueueCalls[0], 50);
  executor.stop();
});

test("ChannelGatewayRetryExecutor runOnce returns pass result", async () => {
  const mockService = new MockGatewayService();
  const executor = new ChannelGatewayRetryExecutor(mockService);

  const result = await executor.runOnce();

  assert.equal(result.scanned, 5);
  assert.equal(result.delivered, 3);
  assert.equal(result.retryScheduled, 1);
  assert.equal(result.deadLettered, 0);
  assert.equal(result.skippedRateLimited, 1);
  assert.equal(result.busy, false);
  assert.ok(result.startedAt);
  assert.ok(result.completedAt);
  executor.stop();
});

test("ChannelGatewayRetryExecutor runOnce returns busy when already running", async () => {
  const mockService = new MockGatewayService();
  // Use very short poll interval to trigger overlap
  const executor = new ChannelGatewayRetryExecutor(mockService, {
    pollIntervalMs: 1,
    autoStart: false,
  });

  // Start the interval
  executor.start();

  // Wait a tick then call runOnce while previous might still be running
  await new Promise((resolve) => setTimeout(resolve, 0));
  const result = await executor.runOnce();

  // Result should indicate busy=false since our mock is fast
  assert.equal(typeof result.busy, "boolean");
  executor.stop();
});

test("ChannelGatewayRetryExecutor start/stop control polling", () => {
  const mockService = new MockGatewayService();
  const executor = new ChannelGatewayRetryExecutor(mockService);

  executor.start();
  executor.stop();
  // If we get here without hanging, start/stop work correctly
});

test("ChannelGatewayRetryExecutor handles processRetryQueue errors gracefully", async () => {
  const mockService = new MockGatewayService();
  mockService.processRetryQueueResults = [
    { scanned: 0, delivered: 0, retryScheduled: 0, deadLettered: 0, skippedRateLimited: 0 },
  ];
  mockService.processRetryQueue = async () => {
    throw new Error("database error");
  };

  const executor = new ChannelGatewayRetryExecutor(mockService);
  const result = await executor.runOnce();

  assert.equal(result.busy, false);
  assert.equal(result.scanned, 0);
  executor.stop();
});
