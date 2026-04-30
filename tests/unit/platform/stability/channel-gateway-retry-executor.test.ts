import assert from "node:assert/strict";
import test from "node:test";

import {
  ChannelGatewayRetryExecutor,
  type ChannelGatewayRetryExecutorOptions,
  type ChannelGatewayRetryPassResult,
} from "../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-retry-executor.js";

test("ChannelGatewayRetryExecutor exports are available", () => {
  assert.equal(typeof ChannelGatewayRetryExecutor, "function");
});

test("ChannelGatewayRetryExecutor can be instantiated with mock service", () => {
  const mockGatewayService = {
    processRetryQueue: async () => ({
      scanned: 0,
      delivered: 0,
      retryScheduled: 0,
      deadLettered: 0,
      skippedRateLimited: 0,
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any);

  assert.ok(executor instanceof ChannelGatewayRetryExecutor);
});

test("ChannelGatewayRetryExecutor runOnce processes retry queue", async () => {
  const mockGatewayService = {
    processRetryQueue: async () => ({
      scanned: 10,
      delivered: 8,
      retryScheduled: 1,
      deadLettered: 0,
      skippedRateLimited: 1,
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any);
  const result = await executor.runOnce();

  assert.equal(result.scanned, 10);
  assert.equal(result.delivered, 8);
  assert.equal(result.retryScheduled, 1);
  assert.equal(result.deadLettered, 0);
  assert.equal(result.skippedRateLimited, 1);
});

test("ChannelGatewayRetryExecutor runOnce returns busy when already running", async () => {
  let resolvePromise: () => void;
  const processingPromise = new Promise<void>((r) => { resolvePromise = r; });

  const mockGatewayService = {
    processRetryQueue: async () => {
      await processingPromise();
      return {
        scanned: 10,
        delivered: 10,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
      };
    },
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any);

  // Start first run
  const firstRun = executor.runOnce();

  // Start second run while first is still running
  const secondRun = executor.runOnce();

  // Wait a small time for both to start
  await new Promise((r) => setTimeout(r, 10));

  // Resolve first promise to unblock
  resolvePromise!();

  const results = await Promise.all([firstRun, secondRun]);

  // First run should not be busy
  assert.equal(results[0].busy, false);
  // Second run should be busy
  assert.equal(results[1].busy, true);
});

test("ChannelGatewayRetryExecutor handles gateway service error gracefully", async () => {
  const mockGatewayService = {
    processRetryQueue: async () => {
      throw new Error("Gateway error");
    },
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any);
  const result = await executor.runOnce();

  // Should return empty summary, not throw
  assert.equal(result.scanned, 0);
  assert.equal(result.delivered, 0);
  assert.equal(result.retryScheduled, 0);
  assert.equal(result.deadLettered, 0);
  assert.equal(result.skippedRateLimited, 0);
  assert.equal(result.busy, false);
});

test("ChannelGatewayRetryExecutor start and stop control polling", () => {
  let callCount = 0;
  const mockGatewayService = {
    processRetryQueue: async () => {
      callCount++;
      return {
        scanned: 0,
        delivered: 0,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
      };
    },
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any, {
    pollIntervalMs: 20,
    autoStart: false,
  });

  executor.start();
  assert.ok(executor["intervalHandle"] != null);

  executor.stop();
  assert.ok(executor["intervalHandle"] == null);
});

test("ChannelGatewayRetryExecutor start has no effect if already running", () => {
  const mockGatewayService = {
    processRetryQueue: async () => ({
      scanned: 0,
      delivered: 0,
      retryScheduled: 0,
      deadLettered: 0,
      skippedRateLimited: 0,
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any, {
    pollIntervalMs: 10000,
  });

  executor.start();
  const firstHandle = executor["intervalHandle"];

  // Start again - should be no-op
  executor.start();
  const secondHandle = executor["intervalHandle"];

  assert.strictEqual(firstHandle, secondHandle);

  executor.stop();
});

test("ChannelGatewayRetryExecutor stop has no effect if not running", () => {
  const mockGatewayService = {
    processRetryQueue: async () => ({
      scanned: 0,
      delivered: 0,
      retryScheduled: 0,
      deadLettered: 0,
      skippedRateLimited: 0,
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any);

  // Not started, so stop should be no-op
  executor.stop();

  assert.ok(executor["intervalHandle"] == null);
});

test("ChannelGatewayRetryExecutor autoStart begins immediately", async () => {
  let runCount = 0;
  const mockGatewayService = {
    processRetryQueue: async () => {
      runCount++;
      return {
        scanned: runCount,
        delivered: runCount,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
      };
    }),
  };

  // autoStart: true should call runOnce immediately and start polling
  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any, {
    pollIntervalMs: 100,
    autoStart: true,
  });

  // Wait a bit for at least one run
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(runCount >= 1);

  executor.stop();
});

test("ChannelGatewayRetryExecutor uses custom poll interval", async () => {
  let callTimes: number[] = [];
  const mockGatewayService = {
    processRetryQueue: async () => {
      callTimes.push(Date.now());
      return {
        scanned: 0,
        delivered: 0,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
      };
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any, {
    pollIntervalMs: 30,
    autoStart: true,
  });

  // Wait for at least 3 calls
  await new Promise((r) => setTimeout(r, 100));

  executor.stop();

  assert.ok(callTimes.length >= 2);

  // Check intervals are roughly correct (30ms +/- 10ms)
  if (callTimes.length >= 2) {
    const interval = callTimes[1] - callTimes[0];
    assert.ok(interval >= 20 && interval <= 50);
  }
});

test("ChannelGatewayRetryExecutor uses custom batch size", () => {
  let processedBatchSize: number | null = null;
  const mockGatewayService = {
    processRetryQueue: async (batchSize: number) => {
      processedBatchSize = batchSize;
      return {
        scanned: batchSize,
        delivered: batchSize,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
      };
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any, {
    batchSize: 50,
  });

  executor.runOnce().catch(() => {});

  assert.equal(processedBatchSize, 50);
});

test("ChannelGatewayRetryExecutor result has correct structure", async () => {
  const mockGatewayService = {
    processRetryQueue: async () => ({
      scanned: 5,
      delivered: 3,
      retryScheduled: 1,
      deadLettered: 1,
      skippedRateLimited: 0,
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any);
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

test("ChannelGatewayRetryExecutor passes through gateway summary", async () => {
  const mockGatewayService = {
    processRetryQueue: async () => ({
      scanned: 100,
      delivered: 95,
      retryScheduled: 3,
      deadLettered: 1,
      skippedRateLimited: 1,
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any);
  const result = await executor.runOnce();

  assert.equal(result.scanned, 100);
  assert.equal(result.delivered, 95);
  assert.equal(result.retryScheduled, 3);
  assert.equal(result.deadLettered, 1);
  assert.equal(result.skippedRateLimited, 1);
});

test("ChannelGatewayRetryExecutor options interface compliance", () => {
  const options: ChannelGatewayRetryExecutorOptions = {
    pollIntervalMs: 20000,
    batchSize: 50,
    autoStart: false,
  };

  const mockGatewayService = {
    processRetryQueue: async () => ({
      scanned: 0,
      delivered: 0,
      retryScheduled: 0,
      deadLettered: 0,
      skippedRateLimited: 0,
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any, options);

  assert.ok(executor instanceof ChannelGatewayRetryExecutor);
});

test("ChannelGatewayRetryExecutor result interface compliance", async () => {
  const mockGatewayService = {
    processRetryQueue: async (): Promise<{
      scanned: number;
      delivered: number;
      retryScheduled: number;
      deadLettered: number;
      skippedRateLimited: number;
    }> => ({
      scanned: 0,
      delivered: 0,
      retryScheduled: 0,
      deadLettered: 0,
      skippedRateLimited: 0,
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any);
  const result = await executor.runOnce();

  const passResult: ChannelGatewayRetryPassResult = result;
  assert.ok(typeof passResult.startedAt === "string");
  assert.ok(typeof passResult.completedAt === "string");
  assert.ok(typeof passResult.busy === "boolean");
});

test("ChannelGatewayRetryExecutor startedAt and completedAt are ISO strings", async () => {
  const mockGatewayService = {
    processRetryQueue: async () => ({
      scanned: 0,
      delivered: 0,
      retryScheduled: 0,
      deadLettered: 0,
      skippedRateLimited: 0,
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any);
  const result = await executor.runOnce();

  // Should be parseable as date
  const startedDate = new Date(result.startedAt);
  const completedDate = new Date(result.completedAt);

  assert.ok(!Number.isNaN(startedDate.getTime()));
  assert.ok(!Number.isNaN(completedDate.getTime()));
});

test("ChannelGatewayRetryExecutor completedAt is after startedAt", async () => {
  const mockGatewayService = {
    processRetryQueue: async () => {
      // Add a small delay
      await new Promise((r) => setTimeout(r, 5));
      return {
        scanned: 0,
        delivered: 0,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
      };
    }),
  };

  const executor = new ChannelGatewayRetryExecutor(mockGatewayService as any);
  const result = await executor.runOnce();

  const startedDate = new Date(result.startedAt).getTime();
  const completedDate = new Date(result.completedAt).getTime();

  assert.ok(completedDate >= startedDate);
});