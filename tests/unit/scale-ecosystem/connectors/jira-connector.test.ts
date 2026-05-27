/**
 * Unit tests for JiraConnector
 *
 * @see src/scale-ecosystem/integration/connectors/jira-connector.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { JiraConnector } from "../../../../src/scale-ecosystem/integration/connectors/jira-connector.js";
import type { ConnectorExecutionRequest } from "../../../../src/scale-ecosystem/integration/connector-runtime/index.js";

function createRequest(overrides: Partial<ConnectorExecutionRequest> = {}): ConnectorExecutionRequest {
  return {
    connectorId: overrides.connectorId ?? "jira-test",
    capability: overrides.capability ?? "create_issue",
    payload: overrides.payload ?? {},
    policyRef: "policyRef" in overrides ? overrides.policyRef : "policy.connector.jira-test",
    secretBindings: "secretBindings" in overrides
      ? overrides.secretBindings
      : [{ secretRef: "secret://jira-test/token", purpose: "api_token" }],
  };
}

test("JiraConnector.listCapabilities returns all supported capabilities [jira-connector]", () => {
  const connector = new JiraConnector();
  const capabilities = connector.listCapabilities();

  assert.deepStrictEqual(capabilities, ["create_issue", "search_issue"]);
});

test("JiraConnector.supportsCapability returns true for create_issue [jira-connector]", () => {
  const connector = new JiraConnector();
  assert.equal(connector.supportsCapability("create_issue"), true);
});

test("JiraConnector.supportsCapability returns true for search_issue [jira-connector]", () => {
  const connector = new JiraConnector();
  assert.equal(connector.supportsCapability("search_issue"), true);
});

test("JiraConnector.supportsCapability returns false for unsupported capabilities [jira-connector]", () => {
  const connector = new JiraConnector();
  assert.equal(connector.supportsCapability("update_issue"), false);
  assert.equal(connector.supportsCapability("delete_issue"), false);
  assert.equal(connector.supportsCapability("assign_issue"), false);
  assert.equal(connector.supportsCapability("CREATE_ISSUE"), false);
});

test("JiraConnector.execute returns success for create_issue capability [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "create_issue" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.connectorId, "jira-test");
});

test("JiraConnector.execute returns success for search_issue capability [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "search_issue" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector.execute returns failure for unknown capability [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "update_issue" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("JiraConnector.execute preserves connectorId from request [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ connectorId: "jira-prod" });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "jira-prod");
});

test("JiraConnector.execute fails when policyRef is missing [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ policyRef: undefined });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("JiraConnector.execute fails when secretBindings are empty [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ secretBindings: [] });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("JiraConnector.execute succeeds with valid policyRef and secretBindings [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({
    policyRef: "policy.connector.jira",
    secretBindings: [{ secretRef: "secret://jira/token", purpose: "api_token" }],
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector.execute handles create_issue with project payload [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({
    capability: "create_issue",
    payload: {
      projectKey: "PROJ",
      issueType: "Task",
      summary: "Test task",
      description: "Task description",
      priority: "High",
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector.execute handles search_issue with JQL payload [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({
    capability: "search_issue",
    payload: {
      jql: "project = PROJ AND status = Open",
      maxResults: 50,
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector.execute handles search_issue with complex JQL [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({
    capability: "search_issue",
    payload: {
      jql: "project = PROJ AND issuetype = Bug AND priority in (High, Highest) AND created >= -30d",
      fields: ["summary", "status", "priority", "assignee"],
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector.execute is case-sensitive for capability names [jira-connector]", () => {
  const connector = new JiraConnector();

  const upperRequest = createRequest({ capability: "CREATE_ISSUE" });
  const lowerRequest = createRequest({ capability: "create_issue" });

  const resultUpper = connector.execute(upperRequest);
  const resultLower = connector.execute(lowerRequest);

  assert.equal(resultUpper.success, false);
  assert.equal(resultUpper.status, "failed");
  assert.equal(resultLower.success, true);
  assert.equal(resultLower.status, "succeeded");
});

test("JiraConnector.execute rejects delete_issue capability [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "delete_issue" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("JiraConnector.execute rejects update_issue capability [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "update_issue" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("JiraConnector.execute handles empty payload [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "create_issue", payload: {} });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector is stateless - multiple executions produce same result [jira-connector]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "create_issue" });

  const result1 = connector.execute(request);
  const result2 = connector.execute(request);

  assert.deepStrictEqual(result1, result2);
});