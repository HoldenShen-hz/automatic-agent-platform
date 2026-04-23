import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChannelGatewayRetryExecutor } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-retry-executor.js";

function createMockGatewayService(processResult: any = { scanned: 0, delivered: 0, retryScheduled: 0, deadLettered: 0, skippedRateLimited: 0 }) {
  return {
    processRetryQueue: async (batchSize: number) => {
      return processResult;
    },
  };
}

describe("channel-gateway/channel-gateway-retry-executor", () => {
  describe("ChannelGatewayRetryExecutor", () => {
    it("should create with default options", () => {
      const mockService = createMockGatewayService();
      const executor = new ChannelGatewayRetryExecutor(mockService as any);
      assert.ok(executor);
      executor.stop();
    });

    it("should create with custom poll interval", () => {
      const mockService = createMockGatewayService();
      const executor = new ChannelGatewayRetryExecutor(mockService as any, { pollIntervalMs: 30000 });
      assert.ok(executor);
      executor.stop();
    });

    it("should create with custom batch size", () => {
      const mockService = createMockGatewayService();
      const executor = new ChannelGatewayRetryExecutor(mockService as any, { batchSize: 50 });
      assert.ok(executor);
      executor.stop();
    });

    it("should run once and return result", async () => {
      const mockService = createMockGatewayService({
        scanned: 5,
        delivered: 3,
        retryScheduled: 1,
        deadLettered: 0,
        skippedRateLimited: 1,
      });
      const executor = new ChannelGatewayRetryExecutor(mockService as any);
      const result = await executor.runOnce();
      assert.equal(result.scanned, 5);
      assert.equal(result.delivered, 3);
      assert.equal(result.retryScheduled, 1);
      assert.equal(result.deadLettered, 0);
      assert.equal(result.skippedRateLimited, 1);
      assert.ok(!result.busy);
      executor.stop();
    });

    it("should return busy result if already running", async () => {
      let resolve: (v: any) => void;
      const mockService = createMockGatewayService(new Promise((r) => { resolve = r; }));
      const executor = new ChannelGatewayRetryExecutor(mockService as any);
      // Start first run
      const p1 = executor.runOnce();
      // Try second run immediately
      const p2 = executor.runOnce();
      const result = await p2;
      assert.ok(result.busy);
      resolve!({ scanned: 1, delivered: 1, retryScheduled: 0, deadLettered: 0, skippedRateLimited: 0 });
      await p1;
      executor.stop();
    });

    it("should start and stop polling", () => {
      const mockService = createMockGatewayService();
      const executor = new ChannelGatewayRetryExecutor(mockService as any, { pollIntervalMs: 60000 });
      executor.start();
      executor.stop();
    });

    it("should not start multiple intervals", () => {
      const mockService = createMockGatewayService();
      const executor = new ChannelGatewayRetryExecutor(mockService as any, { pollIntervalMs: 60000 });
      executor.start();
      executor.start();
      executor.start();
      executor.stop();
    });

    it("should handle errors gracefully", async () => {
      const mockService = createMockGatewayService();
      mockService.processRetryQueue = async () => {
        throw new Error("Database error");
      };
      const executor = new ChannelGatewayRetryExecutor(mockService as any);
      const result = await executor.runOnce();
      assert.equal(result.scanned, 0);
      assert.equal(result.delivered, 0);
      assert.ok(!result.busy);
      executor.stop();
    });
  });
});