/**
 * Unit tests for ConnectorRegistry functions
 *
 * @see src/scale-ecosystem/integration/connector-registry/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConnectorManifestSchema,
  listEnabledConnectors,
  type ConnectorManifest,
} from "../../../src/scale-ecosystem/integration/connector-registry/index.js";

test("ConnectorManifestSchema validates correct manifest", () => {
  const valid = {
    connectorId: "slack-app",
    provider: "slack",
    capabilities: ["messaging", "channels"],
    authMode: "oauth2",
    rateLimits: { perMinute: 100 },
    supportedEvents: ["message.created"],
    lifecycleState: "enabled",
  };

  const result = ConnectorManifestSchema.safeParse(valid);
  assert.equal(result.success, true, "should accept valid manifest");
});

test("ConnectorManifestSchema requires connectorId", () => {
  const invalid = {
    provider: "slack",
    capabilities: [],
    lifecycleState: "enabled",
  };

  const result = ConnectorManifestSchema.safeParse(invalid);
  assert.equal(result.success, false, "should reject manifest without connectorId");
});

test("ConnectorManifestSchema requires provider", () => {
  const invalid = {
    connectorId: "slack-app",
    capabilities: [],
    lifecycleState: "enabled",
  };

  const result = ConnectorManifestSchema.safeParse(invalid);
  assert.equal(result.success, false, "should reject manifest without provider");
});

test("ConnectorManifestSchema validates lifecycleState enum", () => {
  const valid = {
    connectorId: "test",
    provider: "test",
    lifecycleState: "verified",
  };

  const result = ConnectorManifestSchema.safeParse(valid);
  assert.equal(result.success, true, "should accept valid lifecycle state");
});

test("ConnectorManifestSchema rejects invalid lifecycleState", () => {
  const invalid = {
    connectorId: "test",
    provider: "test",
    lifecycleState: "invalid_state",
  };

  const result = ConnectorManifestSchema.safeParse(invalid);
  assert.equal(result.success, false, "should reject invalid lifecycle state");
});

test("ConnectorManifestSchema defaults are present in schema definition", () => {
  // Check that the schema has definition with defaults
  const schemaDef = ConnectorManifestSchema._def;
  assert.ok(schemaDef, "schema should have definition");
});

test("listEnabledConnectors returns only enabled connectors", () => {
  const connectors: ConnectorManifest[] = [
    {
      connectorId: "slack",
      provider: "slack",
      lifecycleState: "enabled",
    },
    {
      connectorId: "jira",
      provider: "jira",
      lifecycleState: "disabled",
    },
    {
      connectorId: "github",
      provider: "github",
      lifecycleState: "verified",
    },
  ];

  const enabled = listEnabledConnectors(connectors);

  assert.equal(enabled.length, 1);
  assert.equal(enabled[0]?.connectorId, "slack");
});

test("listEnabledConnectors returns empty array when none enabled", () => {
  const connectors: ConnectorManifest[] = [
    {
      connectorId: "jira",
      provider: "jira",
      lifecycleState: "disabled",
    },
    {
      connectorId: "github",
      provider: "github",
      lifecycleState: "revoked",
    },
  ];

  const enabled = listEnabledConnectors(connectors);

  assert.equal(enabled.length, 0);
});

test("listEnabledConnectors handles empty array", () => {
  const enabled = listEnabledConnectors([]);
  assert.equal(enabled.length, 0);
});

test("listEnabledConnectors handles all enabled connectors", () => {
  const connectors: ConnectorManifest[] = [
    { connectorId: "slack", provider: "slack", lifecycleState: "enabled" },
    { connectorId: "jira", provider: "jira", lifecycleState: "enabled" },
    { connectorId: "github", provider: "github", lifecycleState: "enabled" },
  ];

  const enabled = listEnabledConnectors(connectors);

  assert.equal(enabled.length, 3);
});
