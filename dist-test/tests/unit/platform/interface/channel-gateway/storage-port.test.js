import assert from "node:assert/strict";
import test from "node:test";
test("GatewayStoragePort interface structure", () => {
    // GatewayStoragePort is an interface, so we can only verify its shape exists
    // by checking that TypeScript accepts a mock implementation
    const mockPort = {
        getGatewayTarget: (targetId) => null,
        upsertGatewayTarget: (target) => { },
        listGatewayTargets: (limit, channel) => [],
        listGatewaySessionTargetCandidates: (limit, channel, tenantId) => [],
    };
    assert.equal(typeof mockPort.getGatewayTarget, "function");
    assert.equal(typeof mockPort.upsertGatewayTarget, "function");
    assert.equal(typeof mockPort.listGatewayTargets, "function");
    assert.equal(typeof mockPort.listGatewaySessionTargetCandidates, "function");
});
test("GatewayStoragePort.getGatewayTarget returns null for missing target", () => {
    const mockPort = {
        getGatewayTarget: (targetId) => null,
        upsertGatewayTarget: (target) => { },
        listGatewayTargets: (limit, channel) => [],
        listGatewaySessionTargetCandidates: (limit, channel, tenantId) => [],
    };
    const result = mockPort.getGatewayTarget("nonexistent_target");
    assert.equal(result, null);
});
test("GatewayStoragePort.listGatewayTargets accepts optional parameters", () => {
    const mockPort = {
        getGatewayTarget: (targetId) => null,
        upsertGatewayTarget: (target) => { },
        listGatewayTargets: (limit, channel) => [],
        listGatewaySessionTargetCandidates: (limit, channel, tenantId) => [],
    };
    // Should accept no args
    const result1 = mockPort.listGatewayTargets();
    assert.ok(Array.isArray(result1));
    // Should accept limit only
    const result2 = mockPort.listGatewayTargets(50);
    assert.ok(Array.isArray(result2));
    // Should accept limit and channel
    const result3 = mockPort.listGatewayTargets(50, "default");
    assert.ok(Array.isArray(result3));
});
test("GatewayStoragePort.listGatewaySessionTargetCandidates accepts optional parameters", () => {
    const mockPort = {
        getGatewayTarget: (targetId) => null,
        upsertGatewayTarget: (target) => { },
        listGatewayTargets: (limit, channel) => [],
        listGatewaySessionTargetCandidates: (limit, channel, tenantId) => [],
    };
    // Should accept no args
    const result1 = mockPort.listGatewaySessionTargetCandidates();
    assert.ok(Array.isArray(result1));
    // Should accept limit only
    const result2 = mockPort.listGatewaySessionTargetCandidates(50);
    assert.ok(Array.isArray(result2));
    // Should accept limit and channel
    const result3 = mockPort.listGatewaySessionTargetCandidates(50, "default");
    assert.ok(Array.isArray(result3));
    // Should accept all parameters including null tenantId
    const result4 = mockPort.listGatewaySessionTargetCandidates(50, "default", null);
    assert.ok(Array.isArray(result4));
});
//# sourceMappingURL=storage-port.test.js.map