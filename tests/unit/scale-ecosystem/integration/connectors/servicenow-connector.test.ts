/**
 * Unit tests for ServiceNowConnector
 *
 * @see src/scale-ecosystem/integration/connectors/servicenow-connector.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ServiceNowConnector } from "../../../../../src/scale-ecosystem/integration/connectors/servicenow-connector.js";
import type { ConnectorExecutionRequest } from "../../../../../src/scale-ecosystem/integration/connector-runtime/index.js";

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

test("ServiceNowConnector.execute returns success for create_incident capability", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "create_incident" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.connectorId, "servicenow-test");
});

test("ServiceNowConnector.execute returns success for update_ticket capability", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "update_ticket" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute returns failure for unknown capability", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "close_incident" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute preserves connectorId from request", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ connectorId: "servicenow-prod-connector" });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "servicenow-prod-connector");
});

test("ServiceNowConnector.execute handles create_incident with full payload", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({
    capability: "create_incident",
    payload: {
      shortDescription: "Server is down",
      description: "Production server not responding",
      impact: 1,
      urgency: 1,
      category: "network",
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute handles update_ticket with ticket payload", () => {
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

test("ServiceNowConnector.execute is case-sensitive for capability names", () => {
  const connector = new ServiceNowConnector();
  const requestUpper = createRequest({ capability: "CREATE_INCIDENT" });
  const requestLower = createRequest({ capability: "create_incident" });

  const resultUpper = connector.execute(requestUpper);
  const resultLower = connector.execute(requestLower);

  // Uppercase should fail
  assert.equal(resultUpper.success, false);
  assert.equal(resultUpper.status, "failed");
  // Lowercase should succeed
  assert.equal(resultLower.success, true);
  assert.equal(resultLower.status, "succeeded");
});

test("ServiceNowConnector.execute rejects get_incident capability", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "get_incident" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute handles empty payload", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({
    capability: "create_incident",
    payload: {},
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ServiceNowConnector.execute rejects delete_ticket capability", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ capability: "delete_ticket" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute fails closed when policyRef is missing", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ policyRef: undefined });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ServiceNowConnector.execute fails closed when secretBindings are missing", () => {
  const connector = new ServiceNowConnector();
  const request = createRequest({ secretBindings: [] });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});
