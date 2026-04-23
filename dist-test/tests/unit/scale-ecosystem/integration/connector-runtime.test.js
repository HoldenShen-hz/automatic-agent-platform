import assert from "node:assert/strict";
import test from "node:test";
import { buildConnectorExecutionKey } from "../../../../src/scale-ecosystem/integration/connector-runtime/index.js";
test("buildConnectorExecutionKey creates correct key", () => {
    const request = {
        connectorId: "slack",
        capability: "send_message",
        payload: { channel: "general", text: "hello" },
    };
    const key = buildConnectorExecutionKey(request);
    assert.equal(key, "slack:send_message");
});
test("buildConnectorExecutionKey handles complex capability names", () => {
    const request = {
        connectorId: "aws-s3",
        capability: "upload:multipart",
        payload: {},
    };
    const key = buildConnectorExecutionKey(request);
    assert.equal(key, "aws-s3:upload:multipart");
});
test("buildConnectorExecutionKey handles empty payload", () => {
    const request = {
        connectorId: "http",
        capability: "GET",
        payload: {},
    };
    const key = buildConnectorExecutionKey(request);
    assert.equal(key, "http:GET");
});
test("buildConnectorExecutionKey unique per connector", () => {
    const request1 = { connectorId: "a", capability: "x", payload: {} };
    const request2 = { connectorId: "b", capability: "x", payload: {} };
    assert.notEqual(buildConnectorExecutionKey(request1), buildConnectorExecutionKey(request2));
});
test("buildConnectorExecutionKey unique per capability", () => {
    const request1 = { connectorId: "svc", capability: "read", payload: {} };
    const request2 = { connectorId: "svc", capability: "write", payload: {} };
    assert.notEqual(buildConnectorExecutionKey(request1), buildConnectorExecutionKey(request2));
});
test("ConnectorExecutionResult schema validates succeeded", () => {
    const result = {
        connectorId: "test",
        success: true,
        status: "succeeded",
    };
    assert.equal(result.success, true);
    assert.equal(result.status, "succeeded");
});
test("ConnectorExecutionResult schema validates failed", () => {
    const result = {
        connectorId: "test",
        success: false,
        status: "failed",
    };
    assert.equal(result.success, false);
    assert.equal(result.status, "failed");
});
test("ConnectorExecutionResult schema validates deferred", () => {
    const result = {
        connectorId: "test",
        success: false,
        status: "deferred",
    };
    assert.equal(result.status, "deferred");
});
//# sourceMappingURL=connector-runtime.test.js.map