import assert from "node:assert/strict";
import test from "node:test";
import { GatewayStorageAdapter } from "../../../../../src/platform/interface/channel-gateway/storage-adapter.js";
test("GatewayStorageAdapter implements GatewayStoragePort interface", () => {
    // Create a mock store
    const mockStore = {
        dispatch: {
            getGatewayTarget: (targetId) => null,
            listGatewayTargets: (limit, channel) => [],
        },
        session: {
            upsertGatewayTarget: (target) => { },
            listGatewaySessionTargetCandidates: (limit, channel, tenantId) => [],
        },
    };
    const adapter = new GatewayStorageAdapter(mockStore);
    // Verify the adapter has the required methods
    assert.equal(typeof adapter.getGatewayTarget, "function");
    assert.equal(typeof adapter.upsertGatewayTarget, "function");
    assert.equal(typeof adapter.listGatewayTargets, "function");
    assert.equal(typeof adapter.listGatewaySessionTargetCandidates, "function");
});
test("GatewayStorageAdapter.getGatewayTarget delegates to store", () => {
    let calledWith;
    const mockStore = {
        dispatch: {
            getGatewayTarget: (targetId) => {
                calledWith = targetId;
                return null;
            },
            listGatewayTargets: (limit, channel) => [],
        },
        session: {
            upsertGatewayTarget: (target) => { },
            listGatewaySessionTargetCandidates: (limit, channel, tenantId) => [],
        },
    };
    const adapter = new GatewayStorageAdapter(mockStore);
    const result = adapter.getGatewayTarget("target_abc");
    assert.equal(calledWith, "target_abc");
    assert.equal(result, null);
});
test("GatewayStorageAdapter.listGatewayTargets delegates to store with default limit", () => {
    let capturedLimit;
    let capturedChannel;
    const mockStore = {
        dispatch: {
            getGatewayTarget: (targetId) => null,
            listGatewayTargets: (limit, channel) => {
                capturedLimit = limit;
                capturedChannel = channel;
                return [];
            },
        },
        session: {
            upsertGatewayTarget: (target) => { },
            listGatewaySessionTargetCandidates: (limit, channel, tenantId) => [],
        },
    };
    const adapter = new GatewayStorageAdapter(mockStore);
    adapter.listGatewayTargets(100, "test-channel");
    assert.equal(capturedLimit, 100);
    assert.equal(capturedChannel, "test-channel");
});
test("GatewayStorageAdapter.listGatewayTargets uses default limit of 100", () => {
    let capturedLimit;
    const mockStore = {
        dispatch: {
            getGatewayTarget: (targetId) => null,
            listGatewayTargets: (limit, channel) => {
                capturedLimit = limit;
                return [];
            },
        },
        session: {
            upsertGatewayTarget: (target) => { },
            listGatewaySessionTargetCandidates: (limit, channel, tenantId) => [],
        },
    };
    const adapter = new GatewayStorageAdapter(mockStore);
    adapter.listGatewayTargets();
    assert.equal(capturedLimit, 100);
});
test("GatewayStorageAdapter.listGatewaySessionTargetCandidates delegates to store", () => {
    let capturedLimit;
    let capturedChannel;
    let capturedTenantId;
    const mockStore = {
        dispatch: {
            getGatewayTarget: (targetId) => null,
            listGatewayTargets: (limit, channel) => [],
        },
        session: {
            upsertGatewayTarget: (target) => { },
            listGatewaySessionTargetCandidates: (limit, channel, tenantId) => {
                capturedLimit = limit;
                capturedChannel = channel;
                capturedTenantId = tenantId;
                return [];
            },
        },
    };
    const adapter = new GatewayStorageAdapter(mockStore);
    adapter.listGatewaySessionTargetCandidates(50, "channel-1", "tenant_abc");
    assert.equal(capturedLimit, 50);
    assert.equal(capturedChannel, "channel-1");
    assert.equal(capturedTenantId, "tenant_abc");
});
test("GatewayStorageAdapter.listGatewaySessionTargetCandidates uses default limit", () => {
    let capturedLimit;
    const mockStore = {
        dispatch: {
            getGatewayTarget: (targetId) => null,
            listGatewayTargets: (limit, channel) => [],
        },
        session: {
            upsertGatewayTarget: (target) => { },
            listGatewaySessionTargetCandidates: (limit, channel, tenantId) => {
                capturedLimit = limit;
                return [];
            },
        },
    };
    const adapter = new GatewayStorageAdapter(mockStore);
    adapter.listGatewaySessionTargetCandidates();
    assert.equal(capturedLimit, 100);
});
//# sourceMappingURL=storage-adapter.test.js.map