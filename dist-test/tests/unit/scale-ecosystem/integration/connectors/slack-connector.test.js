/**
 * Unit tests for SlackConnector
 *
 * @see src/scale-ecosystem/integration/connectors/slack-connector.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SlackConnector } from "../../../../../src/scale-ecosystem/integration/connectors/slack-connector.js";
function createRequest(overrides = {}) {
    return {
        connectorId: overrides.connectorId ?? "slack-test",
        capability: overrides.capability ?? "send_message",
        payload: overrides.payload ?? {},
    };
}
test("SlackConnector.execute returns success for send_message capability", () => {
    const connector = new SlackConnector();
    const request = createRequest({ capability: "send_message" });
    const result = connector.execute(request);
    assert.equal(result.success, true);
    assert.equal(result.status, "succeeded");
    assert.equal(result.connectorId, "slack-test");
});
test("SlackConnector.execute returns success for open_modal capability", () => {
    const connector = new SlackConnector();
    const request = createRequest({ capability: "open_modal" });
    const result = connector.execute(request);
    assert.equal(result.success, true);
    assert.equal(result.status, "succeeded");
});
test("SlackConnector.execute returns failure for unknown capability", () => {
    const connector = new SlackConnector();
    const request = createRequest({ capability: "unknown_action" });
    const result = connector.execute(request);
    assert.equal(result.success, false);
    assert.equal(result.status, "failed");
});
test("SlackConnector.execute preserves connectorId from request", () => {
    const connector = new SlackConnector();
    const request = createRequest({ connectorId: "custom-connector-id" });
    const result = connector.execute(request);
    assert.equal(result.connectorId, "custom-connector-id");
});
test("SlackConnector.execute handles different payload structures", () => {
    const connector = new SlackConnector();
    const request = createRequest({
        capability: "send_message",
        payload: { channel: "#general", text: "Hello world" },
    });
    const result = connector.execute(request);
    assert.equal(result.success, true);
    assert.equal(result.status, "succeeded");
});
test("SlackConnector.execute handles empty payload", () => {
    const connector = new SlackConnector();
    const request = createRequest({
        capability: "send_message",
        payload: {},
    });
    const result = connector.execute(request);
    assert.equal(result.success, true);
    assert.equal(result.status, "succeeded");
});
test("SlackConnector.execute is case-sensitive for capability names", () => {
    const connector = new SlackConnector();
    const requestUpper = createRequest({ capability: "SEND_MESSAGE" });
    const requestLower = createRequest({ capability: "send_message" });
    const resultUpper = connector.execute(requestUpper);
    const resultLower = connector.execute(requestLower);
    // Uppercase should fail since it doesn't match the expected capability
    assert.equal(resultUpper.success, false);
    assert.equal(resultUpper.status, "failed");
    // Lowercase should succeed
    assert.equal(resultLower.success, true);
    assert.equal(resultLower.status, "succeeded");
});
//# sourceMappingURL=slack-connector.test.js.map