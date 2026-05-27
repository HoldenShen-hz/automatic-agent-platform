/**
 * Unit tests for Connector Adapters
 *
 * @see src/scale-ecosystem/integration/connectors/*.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { SlackConnector } from "../../../../src/scale-ecosystem/integration/connectors/slack-connector.js";
import { GitHubConnector } from "../../../../src/scale-ecosystem/integration/connectors/github-connector.js";
import { JiraConnector } from "../../../../src/scale-ecosystem/integration/connectors/jira-connector.js";
import { ServiceNowConnector } from "../../../../src/scale-ecosystem/integration/connectors/servicenow-connector.js";
import type { ConnectorExecutionRequest } from "../../../../src/scale-ecosystem/integration/connector-runtime/index.js";

function createMockRequest(overrides: Partial<ConnectorExecutionRequest> = {}): ConnectorExecutionRequest {
  return {
    connectorId: "test-connector",
    capability: "test_capability",
    payload: {},
    policyRef: "policy.connector.default",
    secretBindings: [{ secretRef: "secret://connector/token", purpose: "api_token" }],
    ...overrides,
  };
}

test("SlackConnector execute returns success for send_message capability [connector-adapter]", () => {
  const connector = new SlackConnector();
  const request = createMockRequest({
    connectorId: "slack",
    capability: "send_message",
    payload: { channel: "general", text: "hello" },
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "slack");
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector execute returns success for open_modal capability [connector-adapter]", () => {
  const connector = new SlackConnector();
  const request = createMockRequest({
    connectorId: "slack",
    capability: "open_modal",
    payload: { triggerId: "123" },
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "slack");
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector execute returns failed for unsupported capability [connector-adapter]", () => {
  const connector = new SlackConnector();
  const request = createMockRequest({
    connectorId: "slack",
    capability: "unknown_action",
    payload: {},
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "slack");
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("GitHubConnector execute returns success for create_pr capability [connector-adapter]", () => {
  const connector = new GitHubConnector();
  const request = createMockRequest({
    connectorId: "github",
    capability: "create_pr",
    payload: { title: "feat: new feature", body: "description" },
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "github");
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector execute returns success for create_issue capability [connector-adapter]", () => {
  const connector = new GitHubConnector();
  const request = createMockRequest({
    connectorId: "github",
    capability: "create_issue",
    payload: { title: "Bug report", body: "description" },
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "github");
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector execute returns success for dispatch_workflow capability [connector-adapter]", () => {
  const connector = new GitHubConnector();
  const request = createMockRequest({
    connectorId: "github",
    capability: "dispatch_workflow",
    payload: { workflowId: "ci.yml", ref: "main" },
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "github");
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector execute returns failed for unsupported capability [connector-adapter]", () => {
  const connector = new GitHubConnector();
  const request = createMockRequest({
    connectorId: "github",
    capability: "merge_pr",
    payload: {},
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "github");
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("JiraConnector execute returns success for create_issue capability [connector-adapter]", () => {
  const connector = new JiraConnector();
  const request = createMockRequest({
    connectorId: "jira",
    capability: "create_issue",
    payload: { projectKey: "TEST", summary: "New issue" },
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "jira");
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector execute returns success for search_issue capability [connector-adapter]", () => {
  const connector = new JiraConnector();
  const request = createMockRequest({
    connectorId: "jira",
    capability: "search_issue",
    payload: { jql: "project = TEST" },
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "jira");
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector execute returns failed for unsupported capability [connector-adapter]", () => {
  const connector = new JiraConnector();
  const request = createMockRequest({
    connectorId: "jira",
    capability: "assign_issue",
    payload: {},
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "jira");
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector execute returns success for create_incident capability [connector-adapter]", () => {
  const connector = new ServiceNowConnector();
  const request = createMockRequest({
    connectorId: "servicenow",
    capability: "create_incident",
    payload: { shortDescription: "Server down", priority: 1 },
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "servicenow");
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector execute returns success for update_ticket capability [connector-adapter]", () => {
  const connector = new ServiceNowConnector();
  const request = createMockRequest({
    connectorId: "servicenow",
    capability: "update_ticket",
    payload: { ticketId: "INC001", status: "resolved" },
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "servicenow");
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector execute returns failed for unsupported capability [connector-adapter]", () => {
  const connector = new ServiceNowConnector();
  const request = createMockRequest({
    connectorId: "servicenow",
    capability: "delete_ticket",
    payload: {},
  });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "servicenow");
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("All connectors preserve connectorId in result [connector-adapter]", () => {
  const connectors = [
    new SlackConnector(),
    new GitHubConnector(),
    new JiraConnector(),
    new ServiceNowConnector(),
  ];

  const connectorIds = ["slack", "github", "jira", "servicenow"];

  for (let i = 0; i < connectors.length; i++) {
    const connector = connectors[i]!;
    const request = createMockRequest({
      connectorId: connectorIds[i]!,
      capability: "unknown",
      payload: {},
    });

    const result = connector.execute(request);
    assert.equal(result.connectorId, connectorIds[i]!);
  }
});

test("All connectors return expected status values [connector-adapter]", () => {
  const connector = new SlackConnector();
  const successRequest = createMockRequest({
    connectorId: "slack",
    capability: "send_message",
    payload: {},
  });

  const failedRequest = createMockRequest({
    connectorId: "slack",
    capability: "invalid",
    payload: {},
  });

  const successResult = connector.execute(successRequest);
  const failedResult = connector.execute(failedRequest);

  assert.equal(successResult.status, "succeeded");
  assert.equal(failedResult.status, "failed");
});

test("Connectors handle complex payloads [connector-adapter]", () => {
  const connector = new SlackConnector();
  const request = createMockRequest({
    connectorId: "slack",
    capability: "send_message",
    payload: {
      channel: "general",
      text: "Hello World",
      blocks: [{ type: "section", text: { type: "plain_text", text: "Hello" } }],
      attachments: [{ color: "#36a64f", text: "Attachment text" }],
    },
  });

  const result = connector.execute(request);
  assert.equal(result.success, true);
});

test("Connectors are instance-based and stateless [connector-adapter]", () => {
  const connector1 = new SlackConnector();
  const connector2 = new SlackConnector();

  const request = createMockRequest({
    connectorId: "slack",
    capability: "send_message",
    payload: {},
  });

  const result1 = connector1.execute(request);
  const result2 = connector2.execute(request);

  assert.deepEqual(result1, result2);
});
