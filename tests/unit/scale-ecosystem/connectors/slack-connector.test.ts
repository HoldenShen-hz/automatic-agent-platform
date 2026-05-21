/**
 * Unit tests for SlackConnector
 *
 * @see src/scale-ecosystem/integration/connectors/slack-connector.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { SlackConnector } from "../../../../../src/scale-ecosystem/integration/connectors/slack-connector.js";
import type { ConnectorExecutionRequest } from "../../../../../src/scale-ecosystem/integration/connector-runtime/index.js";

function createRequest(overrides: Partial<ConnectorExecutionRequest> = {}): ConnectorExecutionRequest {
  return {
    connectorId: overrides.connectorId ?? "slack-test",
    capability: overrides.capability ?? "send_message",
    payload: overrides.payload ?? {},
    policyRef: "policyRef" in overrides ? overrides.policyRef : "policy.connector.slack-test",
    secretBindings: "secretBindings" in overrides
      ? overrides.secretBindings
      : [{ secretRef: "secret://slack-test/token", purpose: "api_token" }],
  };
}

test("SlackConnector.listCapabilities returns all supported capabilities", () => {
  const connector = new SlackConnector();
  const capabilities = connector.listCapabilities();

  assert.deepStrictEqual(capabilities, ["send_message", "open_modal"]);
});

test("SlackConnector.supportsCapability returns true for send_message", () => {
  const connector = new SlackConnector();
  assert.equal(connector.supportsCapability("send_message"), true);
});

test("SlackConnector.supportsCapability returns true for open_modal", () => {
  const connector = new SlackConnector();
  assert.equal(connector.supportsCapability("open_modal"), true);
});

test("SlackConnector.supportsCapability returns false for unsupported capabilities", () => {
  const connector = new SlackConnector();
  assert.equal(connector.supportsCapability("archive_channel"), false);
  assert.equal(connector.supportsCapability("kick_user"), false);
  assert.equal(connector.supportsCapability("SEND_MESSAGE"), false);
});

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
  const request = createRequest({ connectorId: "slack-custom" });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "slack-custom");
});

test("SlackConnector.execute fails when policyRef is missing", () => {
  const connector = new SlackConnector();
  const request = createRequest({ policyRef: undefined });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("SlackConnector.execute fails when secretBindings are empty", () => {
  const connector = new SlackConnector();
  const request = createRequest({ secretBindings: [] });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("SlackConnector.execute succeeds with valid policyRef and secretBindings", () => {
  const connector = new SlackConnector();
  const request = createRequest({
    policyRef: "policy.connector.slack",
    secretBindings: [{ secretRef: "secret://slack/token", purpose: "api_token" }],
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.execute handles send_message with channel and text", () => {
  const connector = new SlackConnector();
  const request = createRequest({
    capability: "send_message",
    payload: { channel: "#general", text: "Hello world" },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.execute handles send_message with blocks", () => {
  const connector = new SlackConnector();
  const request = createRequest({
    capability: "send_message",
    payload: {
      channel: "#alerts",
      text: "Deployment completed",
      blocks: [
        {
          type: "section",
          text: { type: "plain_text", text: "Deployment successful" },
        },
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "View Logs" }, action_id: "view_logs" },
          ],
        },
      ],
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.execute handles send_message with attachments", () => {
  const connector = new SlackConnector();
  const request = createRequest({
    capability: "send_message",
    payload: {
      channel: "#notifications",
      text: "Build results",
      attachments: [
        {
          color: "#36a64f",
          title: "Build #1234",
          text: "Passed: 150 tests, Failed: 0",
        },
      ],
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.execute handles open_modal with trigger_id", () => {
  const connector = new SlackConnector();
  const request = createRequest({
    capability: "open_modal",
    payload: {
      triggerId: "1234567890.1234567890.abcdefghijklmnopqrstuvwxyz",
      view: {
        type: "modal",
        title: { type: "plain_text", text: "Create Issue" },
        blocks: [
          {
            type: "input",
            element: { type: "plain_text_input", action_id: "title_input" },
            label: { type: "plain_text", text: "Issue Title" },
          },
        ],
      },
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.execute handles open_modal with interactive components", () => {
  const connector = new SlackConnector();
  const request = createRequest({
    capability: "open_modal",
    payload: {
      triggerId: "1234567890.1234567890.abcdefghijklmnopqrstuvwxyz",
      view: {
        type: "modal",
        title: { type: "plain_text", text: "Configure Integration" },
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: "Configure your *GitHub* integration" },
          },
          {
            type: "actions",
            elements: [
              { type: "button", text: { type: "plain_text", text: "Connect" }, action_id: "connect_github" },
              { type: "button", text: { type: "plain_text", text: "Skip" }, action_id: "skip" },
            ],
          },
        ],
      },
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.execute is case-sensitive for capability names", () => {
  const connector = new SlackConnector();

  const upperRequest = createRequest({ capability: "SEND_MESSAGE" });
  const lowerRequest = createRequest({ capability: "send_message" });

  const resultUpper = connector.execute(upperRequest);
  const resultLower = connector.execute(lowerRequest);

  assert.equal(resultUpper.success, false);
  assert.equal(resultUpper.status, "failed");
  assert.equal(resultLower.success, true);
  assert.equal(resultLower.status, "succeeded");
});

test("SlackConnector.execute rejects archive_channel capability", () => {
  const connector = new SlackConnector();
  const request = createRequest({ capability: "archive_channel" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("SlackConnector.execute rejects kick_user capability", () => {
  const connector = new SlackConnector();
  const request = createRequest({ capability: "kick_user" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("SlackConnector.execute handles empty payload", () => {
  const connector = new SlackConnector();
  const request = createRequest({ capability: "send_message", payload: {} });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.execute handles empty payload for open_modal", () => {
  const connector = new SlackConnector();
  const request = createRequest({ capability: "open_modal", payload: {} });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("SlackConnector.is stateless - multiple executions produce same result", () => {
  const connector = new SlackConnector();
  const request = createRequest({ capability: "send_message" });

  const result1 = connector.execute(request);
  const result2 = connector.execute(request);

  assert.deepStrictEqual(result1, result2);
});

test("SlackConnector.execute handles send_message to DM channel", () => {
  const connector = new SlackConnector();
  const request = createRequest({
    capability: "send_message",
    payload: {
      channel: "@user@example.com",
      text: "Direct message notification",
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});