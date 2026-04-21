import assert from "node:assert/strict";
import test from "node:test";
import { ChannelGatewayRetryExecutor } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-retry-executor.js";
test("channel gateway retry executor runs a retry pass through the gateway service", async () => {
    const passes = [];
    const gatewayService = {
        async processRetryQueue(limit) {
            passes.push(limit ?? 0);
            return {
                scanned: 2,
                delivered: 1,
                retryScheduled: 1,
                deadLettered: 0,
                skippedRateLimited: 0,
            };
        },
    };
    const executor = new ChannelGatewayRetryExecutor(gatewayService, {
        batchSize: 7,
    });
    const result = await executor.runOnce();
    assert.equal(result.busy, false);
    assert.equal(result.scanned, 2);
    assert.equal(result.delivered, 1);
    assert.equal(result.retryScheduled, 1);
    assert.deepEqual(passes, [7]);
});
test("channel gateway retry executor returns busy result when already running", async () => {
    const gatewayService = {
        async processRetryQueue() {
            // Simulate a long-running operation - 200ms
            await new Promise((resolve) => setTimeout(resolve, 200));
            return {
                scanned: 1,
                delivered: 1,
                retryScheduled: 0,
                deadLettered: 0,
                skippedRateLimited: 0,
            };
        },
    };
    const executor = new ChannelGatewayRetryExecutor(gatewayService, {
        batchSize: 25,
    });
    // Call runOnce without await - this starts the first run in background
    // Since autoStart is false, the polling interval won't cause issues
    const firstRunPromise = executor.runOnce();
    // Wait a tiny bit for the first call to start and set this.running = true
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Call runOnce again immediately - should get busy: true since first run is still in progress
    const secondResult = executor.runOnce();
    const busyResult = await secondResult;
    // The second call should return busy: true
    assert.equal(busyResult.busy, true);
    assert.equal(busyResult.scanned, 0);
    // Wait for first to complete
    await firstRunPromise;
    executor.stop();
});
test("channel gateway retry executor handles error from gateway service", async () => {
    const gatewayService = {
        async processRetryQueue() {
            throw new Error("Database connection failed");
        },
    };
    const executor = new ChannelGatewayRetryExecutor(gatewayService, {
        batchSize: 25,
    });
    const result = await executor.runOnce();
    // Should return empty summary on error, not throw
    assert.equal(result.busy, false);
    assert.equal(result.scanned, 0);
    assert.equal(result.delivered, 0);
    assert.equal(result.retryScheduled, 0);
});
test("channel gateway retry executor start and stop work correctly", () => {
    const gatewayService = {
        async processRetryQueue() {
            return {
                scanned: 0,
                delivered: 0,
                retryScheduled: 0,
                deadLettered: 0,
                skippedRateLimited: 0,
            };
        },
    };
    const executor = new ChannelGatewayRetryExecutor(gatewayService, {
        pollIntervalMs: 10000, // Long interval - won't fire during test
    });
    // Initially not running (no interval handle)
    executor.start();
    executor.start(); // Second start should be no-op
    executor.stop();
    executor.stop(); // Second stop should be no-op
});
test("channel gateway retry executor uses default values", async () => {
    const passes = [];
    const gatewayService = {
        async processRetryQueue(limit) {
            passes.push(limit);
            return {
                scanned: 0,
                delivered: 0,
                retryScheduled: 0,
                deadLettered: 0,
                skippedRateLimited: 0,
            };
        },
    };
    const executor = new ChannelGatewayRetryExecutor(gatewayService);
    await executor.runOnce();
    // Default batch size is 25
    assert.deepEqual(passes, [25]);
});
test("channel gateway retry executor autoStart runs immediately then starts polling", async () => {
    const callCount = { value: 0 };
    const gatewayService = {
        async processRetryQueue() {
            callCount.value++;
            return {
                scanned: 0,
                delivered: 0,
                retryScheduled: 0,
                deadLettered: 0,
                skippedRateLimited: 0,
            };
        },
    };
    const executor = new ChannelGatewayRetryExecutor(gatewayService, {
        pollIntervalMs: 50,
        autoStart: true,
    });
    // Wait for autoStart to trigger at least one run
    await new Promise((resolve) => setTimeout(resolve, 70));
    // Should have run at least once (possibly twice due to timing)
    assert.ok(callCount.value >= 1, `Expected at least 1 call, got ${callCount.value}`);
    executor.stop();
});
//# sourceMappingURL=channel-gateway-retry-executor.test.js.map