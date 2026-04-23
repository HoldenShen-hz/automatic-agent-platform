/**
 * Unit tests for JiraConnector
 *
 * @see src/scale-ecosystem/integration/connectors/jira-connector.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { JiraConnector } from "../../../../../src/scale-ecosystem/integration/connectors/jira-connector.js";
function createRequest(overrides = {}) {
    return {
        connectorId: overrides.connectorId ?? "jira-test",
        capability: overrides.capability ?? "create_issue",
        payload: overrides.payload ?? {},
    };
}
test("JiraConnector.execute returns success for create_issue capability", () => {
    const connector = new JiraConnector();
    const request = createRequest({ capability: "create_issue" });
    const result = connector.execute(request);
    assert.equal(result.success, true);
    assert.equal(result.status, "succeeded");
    assert.equal(result.connectorId, "jira-test");
});
test("JiraConnector.execute returns success for search_issue capability", () => {
    const connector = new JiraConnector();
    const request = createRequest({ capability: "search_issue" });
    const result = connector.execute(request);
    assert.equal(result.success, true);
    assert.equal(result.status, "succeeded");
});
test("JiraConnector.execute returns failure for unknown capability", () => {
    const connector = new JiraConnector();
    const request = createRequest({ capability: "update_issue" });
    const result = connector.execute(request);
    assert.equal(result.success, false);
    assert.equal(result.status, "failed");
});
test("JiraConnector.execute preserves connectorId from request", () => {
    const connector = new JiraConnector();
    const request = createRequest({ connectorId: "jira-prod-connector" });
    const result = connector.execute(request);
    assert.equal(result.connectorId, "jira-prod-connector");
});
test("JiraConnector.execute handles create_issue with full payload", () => {
    const connector = new JiraConnector();
    const request = createRequest({
        capability: "create_issue",
        payload: {
            projectKey: "PROJ",
            issueType: "Task",
            summary: "Test issue",
            description: "Test description",
            priority: "High",
        },
    });
    const result = connector.execute(request);
    assert.equal(result.success, true);
    assert.equal(result.status, "succeeded");
});
test("JiraConnector.execute handles search_issue with JQL payload", () => {
    const connector = new JiraConnector();
    const request = createRequest({
        capability: "search_issue",
        payload: { jql: "project = PROJ AND status = Open" },
    });
    const result = connector.execute(request);
    assert.equal(result.success, true);
    assert.equal(result.status, "succeeded");
});
test("JiraConnector.execute is case-sensitive for capability names", () => {
    const connector = new JiraConnector();
    const requestUpper = createRequest({ capability: "CREATE_ISSUE" });
    const requestLower = createRequest({ capability: "create_issue" });
    const resultUpper = connector.execute(requestUpper);
    const resultLower = connector.execute(requestLower);
    // Uppercase should fail
    assert.equal(resultUpper.success, false);
    assert.equal(resultUpper.status, "failed");
    // Lowercase should succeed
    assert.equal(resultLower.success, true);
    assert.equal(resultLower.status, "succeeded");
});
test("JiraConnector.execute rejects delete_issue capability", () => {
    const connector = new JiraConnector();
    const request = createRequest({ capability: "delete_issue" });
    const result = connector.execute(request);
    assert.equal(result.success, false);
    assert.equal(result.status, "failed");
});
//# sourceMappingURL=jira-connector.test.js.map