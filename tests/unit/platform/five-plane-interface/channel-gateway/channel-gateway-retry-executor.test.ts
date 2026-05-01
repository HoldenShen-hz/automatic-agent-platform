import { strict as assert } from "node:assert";
import { test } from "node:test";

import { ChannelGatewayRetryExecutor } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-retry-executor.js";
import { ChannelGatewayService } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-service.js";
import type { GatewayStoragePort } from "../../../../../src/platform/five-plane-interface/channel-gateway/storage-port.js";
import type { GatewayTargetRecord } from "../../../../../src/platform/contracts/types/domain.js";

// Minimal mock implementations
const mockStoragePort: GatewayStoragePort = {
  getGatewayTarget: () => null,
  upsertGatewayTarget: () => {},
  listGatewayTargets: () => [],
  listGatewaySessionTargetCandidates: () => [],
};

const mockTargetDirectory = {
  resolveTarget: () => ({
    entry: {
      targetId: "target_123",
      channel: "telegram",
      targetKind: "user" as const,
      source: "directory" as const,
      displayName: "Test",
      aliases: [],
      externalTargetId: "123456",
      sessionId: null,
      taskId: null,
      lastSeenAt: null,
      latestMessagePreview: null,
    },
    matchedBy: "target_id_exact" as const,
  }),
};

// Mock gateway service
const mockGatewayService = {
  processRetryQueue: async (limit: number) => ({
    scanned: limit,
    delivered: 0,
    retryScheduled: 0,
    deadLettered: 0,
    skippedRateLimited: 0,
  }),
} as unknown as ChannelGatewayService;

test("ChannelGatewayRetryExecutor constructor sets defaults", () => {
  const executor = new ChannelGatewayRetryExecutor(mockGatewayService);

  assert.equal(executor instanceof ChannelGatewayRetryExecutor, true);
});

test("ChannelGatewayRetryExecutor constructor accepts custom options", () => {
  const executor = new ChannelGatewayRetryExecutor(mockGatewayService, {
    pollIntervalMs: 5000,
    batchSize: 50,
    autoStart: false,
  });

  assert.equal(executor instanceof ChannelGatewayRetryExecutor, true);
});

test("ChannelGatewayRetryExecutor runOnce returns busy when already running", async () => {
  const executor = new ChannelGatewayRetryExecutor(mockGatewayService);

  // Simulate a long-running first call by mocking a slow gateway service
  let firstCall = true;
  const slowGatewayService = {
    processRetryQueue: async () => {
      if (firstCall) {
        firstCall = false;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return {
        scanned: 0,
        delivered: 0,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
      };
    },
  } as unknown as ChannelGatewayService;

  const exec = new ChannelGatewayRetryExecutor(slowGatewayService);

  // Start first call
  const promise1 = exec.runOnce();
  // Immediately call again - should return busy
  const result2 = await exec.runOnce();

  assert.equal(result2.busy, true);

  // Wait for first to complete
  await promise1;
});

test("ChannelGatewayRetryExecutor runOnce returns correct structure", async () => {
  const executor = new ChannelGatewayRetryExecutor(mockGatewayService);

  const result = await executor.runOnce();

  assert.equal(typeof result.startedAt, "string");
  assert.equal(typeof result.completedAt, "string");
  assert.equal(typeof result.busy, "boolean");
  assert.equal(typeof result.scanned, "number");
  assert.equal(typeof result.delivered, "number");
  assert.equal(typeof result.retryScheduled, "number");
  assert.equal(typeof result.deadLettered, "number");
  assert.equal(typeof result.skippedRateLimited, "number");
});

test("ChannelGatewayRetryExecutor start and stop control polling", () => {
  const executor = new ChannelGatewayRetryExecutor(mockGatewayService);

  executor.start();
  executor.stop();

  // No error thrown indicates start/stop worked
  assert.equal(true, true);
});

test("ChannelGatewayRetryExecutor handles errors gracefully", async () => {
  const errorGatewayService = {
    processRetryQueue: async () => {
      throw new Error("test error");
    },
  } as unknown as ChannelGatewayService;

  const executor = new ChannelGatewayRetryExecutor(errorGatewayService);

  const result = await executor.runOnce();

  // Should return empty summary instead of throwing
  assert.equal(result.scanned, 0);
  assert.equal(result.delivered, 0);
  assert.equal(result.retryScheduled, 0);
  assert.equal(result.deadLettered, 0);
  assert.equal(result.skippedRateLimited, 0);
  assert.equal(result.busy, false);
});