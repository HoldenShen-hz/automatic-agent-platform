/**
 * Unit tests for all connectors
 *
 * @see src/scale-ecosystem/integration/connectors/
 */

import assert from "node:assert/strict";
import test from "node:test";
import { GitHubConnector } from "../../../../src/scale-ecosystem/integration/connectors/github-connector.js";
import { JiraConnector } from "../../../../src/scale-ecosystem/integration/connectors/jira-connector.js";
import { ServiceNowConnector } from "../../../../src/scale-ecosystem/integration/connectors/servicenow-connector.js";
import { SlackConnector } from "../../../../src/scale-ecosystem/integration/connectors/slack-connector.js";
import type { ConnectorExecutionRequest } from "../../../../src/scale-ecosystem/integration/connector-runtime/index.js";

function createRequest(overrides: Partial<ConnectorExecutionRequest> = {}): ConnectorExecutionRequest {
  return {
    connectorId: overrides.connectorId ?? "test-connector",
    capability: overrides.capability ?? "create_pr",
    payload: overrides.payload ?? {},
    policyRef: "policyRef" in overrides ? overrides.policyRef : "policy.connector.default",
    secretBindings: "secretBindings" in overrides
      ? overrides.secretBindings
      : [{ secretRef: "secret://connector/token", purpose: "api_token" }],
  };
}

// GitHubConnector tests

test("GitHubConnector.execute returns success for create_pr capability [connectors]", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "create_pr", connectorId: "github-test" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.connectorId, "github-test");
});

test("GitHubConnector.execute returns success for create_issue capability [connectors]", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "create_issue" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute returns success for dispatch_workflow capability [connectors]", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "dispatch_workflow" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute returns failure for unknown capability [connectors]", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "merge_pr" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("GitHubConnector.execute preserves connectorId from request [connectors]", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ connectorId: "github-enterprise" });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "github-enterprise");
});

test("GitHubConnector.execute handles create_pr with full payload [connectors]", () => {
  const connector = new GitHubConnector();
  const request = createRequest({
    capability: "create_pr",
    payload: { owner: "org", repo: "repo", title: "PR Title", head: "feature", base: "main" },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute handles create_issue with labels payload [connectors]", () => {
  const connector = new GitHubConnector();
  const request = createRequest({
    capability: "create_issue",
    payload: { owner: "org", repo: "repo", title: "Bug", body: "Description", labels: ["bug"] },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute handles empty payload [connectors]", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "create_pr", payload: {} });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute is case-sensitive [connectors]", () => {
  const connector = new GitHubConnector();
  const upperRequest = createRequest({ capability: "CREATE_PR" });
  const lowerRequest = createRequest({ capability: "create_pr" });

  const upperResult = connector.execute(upperRequest);
  const lowerResult = connector.execute(lowerRequest);

  assert.equal(upperResult.success, false);
  assert.equal(upperResult.status, "failed");
  assert.equal(lowerResult.success, true);
  assert.equal(lowerResult.status, "succeeded");
});

test("GitHubConnector exposes supported capabilities [connectors]", () => {
  const connector = new GitHubConnector();
  assert.deepStrictEqual(connector.listCapabilities(), ["create_pr", "create_issue", "dispatch_workflow"]);
  assert.equal(connector.supportsCapability("create_pr"), true);
  assert.equal(connector.supportsCapability("merge_pr"), false);
});

// JiraConnector tests

test("JiraConnector.execute returns success for create_issue capability [connectors]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "create_issue", connectorId: "jira-test" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.connectorId, "jira-test");
});

test("JiraConnector.execute returns success for search_issue capability [connectors]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "search_issue" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector.execute returns failure for unknown capability [connectors]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "update_issue" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("JiraConnector.execute preserves connectorId from request [connectors]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ connectorId: "jira-prod" });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "jira-prod");
});

test("JiraConnector.execute handles create_issue with project payload [connectors]", () => {
  const connector = new JiraConnector();
  const request = createRequest({
    capability: "create_issue",
    payload: { projectKey: "PROJ", issueType: "Task", summary: "Test", description: "Desc", priority: "High" },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector.execute handles search_issue with JQL [connectors]", () => {
  const connector = new JiraConnector();
  const request = createRequest({
    capability: "search_issue",
    payload: { jql: "project = PROJ AND status = Open" },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("JiraConnector.execute is case-sensitive [connectors]", () => {
  const connector = new JiraConnector();
  const upperRequest = createRequest({ capability: "CREATE_ISSUE" });
  const lowerRequest = createRequest({ capability: "create_issue" });

  const upperResult = connector.execute(upperRequest);
  const lowerResult = connector.execute(lowerRequest);

  assert.equal(upperResult.success, false);
  assert.equal(upperResult.status, "failed");
  assert.equal(lowerResult.success, true);
  assert.equal(lowerResult.status, "succeeded");
});

test("JiraConnector.execute rejects delete_issue [connectors]", () => {
  const connector = new JiraConnector();
  const request = createRequest({ capability: "delete_issue" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("JiraConnector exposes supported capabilities [connectors]", () => {
  const connector = new JiraConnector();
  assert.deepStrictEqual(connector.listCapabilities(), ["create_issue", "search_issue"]);
  assert.equal(connector.supportsCapability("create_issue"), true);
  assert.equal(connector.supportsCapability("delete_issue"), false);
});

// ServiceNowConnector tests

test("ServiceNowConnector.execute returns success for create_incident capability [connectors]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "create_incident", connectorId: "servicenow-test" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.connectorId, "servicenow-test");
});

test("ServiceNowConnector.execute returns success for update_ticket capability [connectors]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "update_ticket" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute returns failure for unknown capability [connectors]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "close_incident" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute preserves connectorId from request [connectors]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ connectorId: "servicenow-prod" });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "servicenow-prod");
});

test("ServiceNowConnector.execute handles create_incident with full payload [connectors]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({
    capability: "create_incident",
    payload: { shortDescription: "Server down", description: "Production server", impact: 1, urgency: 1, category: "network" },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute handles update_ticket with ticket payload [connectors]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({
    capability: "update_ticket",
    payload: { ticketId: "INC0012345", state: "in_progress", assignedTo: "admin@example.com" },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute is case-sensitive [connectors]", () => {
  const connector = new ServiceNowConnector();
  const upperRequest = createRequest({ capability: "CREATE_INCIDENT" });
  const lowerRequest = createRequest({ capability: "create_incident" });

  const upperResult = connector.execute(upperRequest);
  const lowerResult = connector.execute(lowerRequest);

  assert.equal(upperResult.success, false);
  assert.equal(upperResult.status, "failed");
  assert.equal(lowerResult.success, true);
  assert.equal(lowerResult.status, "succeeded");
});

test("ServiceNowConnector.execute rejects get_incident [connectors]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "get_incident" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute rejects delete_ticket [connectors]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "delete_ticket" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute handles empty payload [connectors]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "create_incident", payload: {} });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

// SlackConnector tests

test("SlackConnector.execute returns success for send_message capability [connectors]", () => {
  const connector = new SlackConnector();
  const request = createRequest({ capability: "send_message", connectorId: "slack-test" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.connectorId, "slack-test");
});

test("SlackConnector.execute returns success for open_modal capability [connectors]", () => {
  const connector = new SlackConnector();
  const request = createRequest({ capability: "open_modal" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.execute returns failure for unknown capability [connectors]", () => {
  const connector = new SlackConnector();
  const request = createRequest({ capability: "unknown_action" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("SlackConnector.execute preserves connectorId from request [connectors]", () => {
  const connector = new SlackConnector();
  const request = createRequest({ connectorId: "slack-custom" });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "slack-custom");
});

test("SlackConnector.execute handles send_message with channel and text [connectors]", () => {
  const connector = new SlackConnector();
  const request = createRequest({
    capability: "send_message",
    payload: { channel: "#general", text: "Hello world" },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.execute handles empty payload [connectors]", () => {
  const connector = new SlackConnector();
  const request = createRequest({ capability: "send_message", payload: {} });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.execute is case-sensitive [connectors]", () => {
  const connector = new SlackConnector();
  const upperRequest = createRequest({ capability: "SEND_MESSAGE" });
  const lowerRequest = createRequest({ capability: "send_message" });

  const upperResult = connector.execute(upperRequest);
  const lowerResult = connector.execute(lowerRequest);

  assert.equal(upperResult.success, false);
  assert.equal(upperResult.status, "failed");
  assert.equal(lowerResult.success, true);
  assert.equal(lowerResult.status, "succeeded");
});

test("SlackConnector.execute rejects archive_channel capability [connectors]", () => {
  const connector = new SlackConnector();
  const request = createRequest({ capability: "archive_channel" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});
