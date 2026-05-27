/**
 * Unit tests for ServiceNowConnector
 *
 * @see src/scale-ecosystem/integration/connectors/servicenow-connector.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ServiceNowConnector } from "../../../../src/scale-ecosystem/integration/connectors/servicenow-connector.js";
import type { ConnectorExecutionRequest } from "../../../../src/scale-ecosystem/integration/connector-runtime/index.js";

function createRequest(overrides: Partial<ConnectorExecutionRequest> = {}): ConnectorExecutionRequest {
  return {
    connectorId: overrides.connectorId ?? "servicenow-test",
    capability: overrides.capability ?? "create_incident",
    payload: overrides.payload ?? {},
    policyRef: "policyRef" in overrides ? overrides.policyRef : "policy.connector.servicenow-test",
    secretBindings: "secretBindings" in overrides
      ? overrides.secretBindings
      : [{ secretRef: "secret://servicenow-test/token", purpose: "api_token" }],
  };
}

test("ServiceNowConnector.listCapabilities returns all supported capabilities [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const capabilities = connector.listCapabilities();

  assert.deepStrictEqual(capabilities, ["create_incident", "update_ticket"]);
});

test("ServiceNowConnector.supportsCapability returns true for create_incident [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  assert.equal(connector.supportsCapability("create_incident"), true);
});

test("ServiceNowConnector.supportsCapability returns true for update_ticket [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  assert.equal(connector.supportsCapability("update_ticket"), true);
});

test("ServiceNowConnector.supportsCapability returns false for unsupported capabilities [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  assert.equal(connector.supportsCapability("close_incident"), false);
  assert.equal(connector.supportsCapability("delete_ticket"), false);
  assert.equal(connector.supportsCapability("get_incident"), false);
  assert.equal(connector.supportsCapability("CREATE_INCIDENT"), false);
});

test("ServiceNowConnector.execute returns success for create_incident capability [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "create_incident" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.connectorId, "servicenow-test");
});

test("ServiceNowConnector.execute returns success for update_ticket capability [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "update_ticket" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute returns failure for unknown capability [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "close_incident" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute preserves connectorId from request [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ connectorId: "servicenow-prod" });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "servicenow-prod");
});

test("ServiceNowConnector.execute fails when policyRef is missing [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ policyRef: undefined });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute fails when secretBindings are empty [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ secretBindings: [] });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute succeeds with valid policyRef and secretBindings [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({
    policyRef: "policy.connector.servicenow",
    secretBindings: [{ secretRef: "secret://servicenow/token", purpose: "api_token" }],
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute handles create_incident with full payload [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({
    capability: "create_incident",
    payload: {
      shortDescription: "Server down",
      description: "Production server is not responding",
      impact: 1,
      urgency: 1,
      category: "network",
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute handles create_incident with various priority levels [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();

  const request1 = createRequest({
    capability: "create_incident",
    payload: { shortDescription: "Critical issue", impact: 1, urgency: 1 },
  });
  const request2 = createRequest({
    capability: "create_incident",
    payload: { shortDescription: "Medium issue", impact: 2, urgency: 2 },
  });

  const result1 = connector.execute(request1);
  const result2 = connector.execute(request2);

  assert.equal(result1.success, true);
  assert.equal(result1.status, "succeeded");
  assert.equal(result2.success, true);
  assert.equal(result2.status, "succeeded");
});

test("ServiceNowConnector.execute handles update_ticket with state changes [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({
    capability: "update_ticket",
    payload: {
      ticketId: "INC0012345",
      state: "in_progress",
      assignedTo: "admin@example.com",
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute handles update_ticket with resolution [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({
    capability: "update_ticket",
    payload: {
      ticketId: "INC0012345",
      state: "resolved",
      resolutionCode: "fixed",
      closeNotes: "Issue resolved by restarting service",
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute is case-sensitive for capability names [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();

  const upperRequest = createRequest({ capability: "CREATE_INCIDENT" });
  const lowerRequest = createRequest({ capability: "create_incident" });

  const resultUpper = connector.execute(upperRequest);
  const resultLower = connector.execute(lowerRequest);

  assert.equal(resultUpper.success, false);
  assert.equal(resultUpper.status, "failed");
  assert.equal(resultLower.success, true);
  assert.equal(resultLower.status, "succeeded");
});

test("ServiceNowConnector.execute rejects get_incident capability [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "get_incident" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute rejects delete_ticket capability [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "delete_ticket" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute handles empty payload [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "create_incident", payload: {} });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector is stateless - multiple executions produce same result [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "create_incident" });

  const result1 = connector.execute(request);
  const result2 = connector.execute(request);

  assert.deepStrictEqual(result1, result2);
});

test("ServiceNowConnector.execute handles update_ticket with empty payload [servicenow-connector]", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "update_ticket", payload: {} });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});