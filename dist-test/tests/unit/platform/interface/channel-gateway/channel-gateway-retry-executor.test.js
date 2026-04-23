import assert from "node:assert/strict";
import test from "node:test";
import { ChannelGatewayRetryExecutor } from "../../../../../src/platform/interface/channel-gateway/channel-gateway-retry-executor.js";
class MockChannelGatewayService {
    processRetryQueueCalls = [];
    processRetryQueueResult = {
        scanned: 0,
        delivered: 0,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
    };
    processRetryQueue(batchSize) {
        this.processRetryQueueCalls.push({ batchSize });
        return Promise.resolve(this.processRetryQueueResult);
    }
}
test("ChannelGatewayRetryExecutor accepts options with defaults", () => {
    const mock = new MockChannelGatewayService();
    const executor = new ChannelGatewayRetryExecutor(mock);
    assert.equal(executor instanceof ChannelGatewayRetryExecutor, true);
    executor.stop();
});
test("ChannelGatewayRetryExecutor accepts custom pollIntervalMs and batchSize", () => {
    const mock = new MockChannelGatewayService();
    const options = {
        pollIntervalMs: 5000,
        batchSize: 10,
    };
    const executor = new ChannelGatewayRetryExecutor(mock, options);
    assert.equal(executor instanceof ChannelGatewayRetryExecutor, true);
    executor.stop();
});
test("ChannelGatewayRetryExecutor.runOnce calls gatewayService.processRetryQueue with batchSize", async () => {
    const mock = new MockChannelGatewayService();
    mock.processRetryQueueResult = {
        scanned: 5,
        delivered: 3,
        retryScheduled: 1,
        deadLettered: 0,
        skippedRateLimited: 1,
    };
    const executor = new ChannelGatewayRetryExecutor(mock, { batchSize: 25 });
    const result = await executor.runOnce();
    assert.equal(mock.processRetryQueueCalls.length, 1);
    assert.equal(mock.processRetryQueueCalls[0].batchSize, 25);
    assert.equal(result.scanned, 5);
    assert.equal(result.delivered, 3);
    assert.equal(result.retryScheduled, 1);
    assert.equal(result.deadLettered, 0);
    assert.equal(result.skippedRateLimited, 1);
    assert.equal(result.busy, false);
    executor.stop();
});
test("ChannelGatewayRetryExecutor.runOnce returns empty summary on error", async () => {
    const mock = new MockChannelGatewayService();
    mock.processRetryQueue = () => {
        return Promise.reject(new Error("Database connection failed"));
    };
    const executor = new ChannelGatewayRetryExecutor(mock, { batchSize: 25 });
    const result = await executor.runOnce();
    assert.equal(result.scanned, 0);
    assert.equal(result.delivered, 0);
    assert.equal(result.retryScheduled, 0);
    assert.equal(result.deadLettered, 0);
    assert.equal(result.skippedRateLimited, 0);
    assert.equal(result.busy, false);
    executor.stop();
});
test("ChannelGatewayRetryExecutor.start begins polling", () => {
    const mock = new MockChannelGatewayService();
    const executor = new ChannelGatewayRetryExecutor(mock, {
        pollIntervalMs: 100,
        batchSize: 25,
    });
    executor.start();
    executor.stop(); // Clean up
});
test("ChannelGatewayRetryExecutor.start has no effect when already running", () => {
    const mock = new MockChannelGatewayService();
    const executor = new ChannelGatewayRetryExecutor(mock, {
        pollIntervalMs: 100,
        batchSize: 25,
    });
    executor.start();
    executor.start(); // Should be no-op
    executor.stop();
});
test("ChannelGatewayRetryExecutor.stop halts polling", () => {
    const mock = new MockChannelGatewayService();
    const executor = new ChannelGatewayRetryExecutor(mock, {
        pollIntervalMs: 50,
        batchSize: 25,
    });
    executor.start();
    executor.stop();
    // Calling stop again should be no-op
    executor.stop();
});
test("ChannelGatewayRetryExecutor.runOnce includes startedAt and completedAt timestamps", async () => {
    const mock = new MockChannelGatewayService();
    mock.processRetryQueueResult = {
        scanned: 1,
        delivered: 1,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
    };
    const executor = new ChannelGatewayRetryExecutor(mock);
    const result = await executor.runOnce();
    assert.equal(typeof result.startedAt, "string");
    assert.equal(typeof result.completedAt, "string");
    assert.ok(result.startedAt.length > 0);
    assert.ok(result.completedAt.length > 0);
    executor.stop();
});
test("ChannelGatewayRetryExecutor autoStart option runs immediately then starts polling", () => {
    const mock = new MockChannelGatewayService();
    mock.processRetryQueueResult = {
        scanned: 1,
        delivered: 1,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
    };
    const executor = new ChannelGatewayRetryExecutor(mock, {
        pollIntervalMs: 100,
        batchSize: 25,
        autoStart: true,
    });
    // autoStart triggers runOnce immediately
    assert.equal(mock.processRetryQueueCalls.length >= 1, true);
    executor.stop();
});
test("ChannelGatewayRetryExecutor processes multiple batches via runOnce", async () => {
    const mock = new MockChannelGatewayService();
    let callCount = 0;
    mock.processRetryQueueResult = {
        scanned: 1,
        delivered: 1,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
    };
    const executor = new ChannelGatewayRetryExecutor(mock, { batchSize: 10 });
    await executor.runOnce();
    callCount++;
    await executor.runOnce();
    callCount++;
    await executor.runOnce();
    callCount++;
    assert.equal(mock.processRetryQueueCalls.length, callCount);
    executor.stop();
});
test("ChannelGatewayRetryExecutor runOnce result has busy=false on success", async () => {
    const mock = new MockChannelGatewayService();
    mock.processRetryQueueResult = {
        scanned: 10,
        delivered: 8,
        retryScheduled: 2,
        deadLettered: 0,
        skippedRateLimited: 0,
    };
    const executor = new ChannelGatewayRetryExecutor(mock, { batchSize: 25 });
    const result = await executor.runOnce();
    assert.equal(result.busy, false);
    executor.stop();
});
test("ChannelGatewayRetryExecutor runOnce result busy flag behavior", async () => {
    const mock = new MockChannelGatewayService();
    mock.processRetryQueueResult = {
        scanned: 5,
        delivered: 5,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
    };
    const executor = new ChannelGatewayRetryExecutor(mock);
    // First call should succeed
    const first = await executor.runOnce();
    assert.equal(first.busy, false);
    // Second call immediately after should also succeed since first completed
    const second = await executor.runOnce();
    assert.equal(second.busy, false);
    executor.stop();
});
//# sourceMappingURL=channel-gateway-retry-executor.test.js.map