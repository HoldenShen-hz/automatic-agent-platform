/**
 * Unit tests for ConnectorRegistry
 *
 * @see src/scale-ecosystem/integration/connector-registry/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConnectorManifestSchema,
  listEnabledConnectors,
  type ConnectorManifest,
} from "../../../../src/scale-ecosystem/integration/connector-registry/index.js";

test("ConnectorManifestSchema validates correct manifest [connector-registry]", () => {
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

test("ConnectorManifestSchema requires connectorId [connector-registry]", () => {
  const invalid = {
    provider: "slack",
    capabilities: [],
    lifecycleState: "enabled",
  };

  const result = ConnectorManifestSchema.safeParse(invalid);
  assert.equal(result.success, false, "should reject manifest without connectorId");
});

test("ConnectorManifestSchema requires provider [connector-registry]", () => {
  const invalid = {
    connectorId: "slack-app",
    capabilities: [],
    lifecycleState: "enabled",
  };

  const result = ConnectorManifestSchema.safeParse(invalid);
  assert.equal(result.success, false, "should reject manifest without provider");
});

test("ConnectorManifestSchema validates lifecycleState enum [connector-registry]", () => {
  const valid = {
    connectorId: "test",
    provider: "test",
    lifecycleState: "verified",
  };

  const result = ConnectorManifestSchema.safeParse(valid);
  assert.equal(result.success, true, "should accept valid lifecycle state");
});

test("ConnectorManifestSchema rejects invalid lifecycleState [connector-registry]", () => {
  const invalid = {
    connectorId: "test",
    provider: "test",
    lifecycleState: "invalid_state",
  };

  const result = ConnectorManifestSchema.safeParse(invalid);
  assert.equal(result.success, false, "should reject invalid lifecycle state");
});

test("ConnectorManifestSchema defaults capabilities to empty array [connector-registry]", () => {
  const minimal = {
    connectorId: "test",
    provider: "test",
    lifecycleState: "registered",
  };

  const result = ConnectorManifestSchema.safeParse(minimal);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.capabilities, []);
  }
});

test("ConnectorManifestSchema defaults authMode to oauth2 [connector-registry]", () => {
  const minimal = {
    connectorId: "test",
    provider: "test",
    lifecycleState: "registered",
  };

  const result = ConnectorManifestSchema.safeParse(minimal);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.authMode, "oauth2");
  }
});

test("ConnectorManifestSchema defaults rateLimits to empty object [connector-registry]", () => {
  const minimal = {
    connectorId: "test",
    provider: "test",
    lifecycleState: "registered",
  };

  const result = ConnectorManifestSchema.safeParse(minimal);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.rateLimits, {});
  }
});

test("ConnectorManifestSchema defaults supportedEvents to empty array [connector-registry]", () => {
  const minimal = {
    connectorId: "test",
    provider: "test",
    lifecycleState: "registered",
  };

  const result = ConnectorManifestSchema.safeParse(minimal);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.supportedEvents, []);
  }
});

test("ConnectorManifestSchema accepts all valid lifecycle states [connector-registry]", () => {
  const states = ["registered", "configured", "verified", "enabled", "disabled", "revoked"] as const;

  for (const lifecycleState of states) {
    const manifest = {
      connectorId: `test-${lifecycleState}`,
      provider: "test",
      lifecycleState,
    };

    const result = ConnectorManifestSchema.safeParse(manifest);
    assert.equal(result.success, true, `should accept lifecycleState: ${lifecycleState}`);
  }
});

test("ConnectorManifestSchema rejects empty connectorId [connector-registry]", () => {
  const invalid = {
    connectorId: "",
    provider: "test",
    lifecycleState: "registered",
  };

  const result = ConnectorManifestSchema.safeParse(invalid);
  assert.equal(result.success, false, "should reject empty connectorId");
});

test("ConnectorManifestSchema rejects empty provider [connector-registry]", () => {
  const invalid = {
    connectorId: "test",
    provider: "",
    lifecycleState: "registered",
  };

  const result = ConnectorManifestSchema.safeParse(invalid);
  assert.equal(result.success, false, "should reject empty provider");
});

test("listEnabledConnectors returns only enabled connectors [connector-registry]", () => {
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

test("listEnabledConnectors returns empty array when none enabled [connector-registry]", () => {
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

test("listEnabledConnectors handles empty array [connector-registry]", () => {
  const enabled = listEnabledConnectors([]);
  assert.equal(enabled.length, 0);
});

test("listEnabledConnectors handles all enabled connectors [connector-registry]", () => {
  const connectors: ConnectorManifest[] = [
    { connectorId: "slack", provider: "slack", lifecycleState: "enabled" },
    { connectorId: "jira", provider: "jira", lifecycleState: "enabled" },
    { connectorId: "github", provider: "github", lifecycleState: "enabled" },
  ];

  const enabled = listEnabledConnectors(connectors);

  assert.equal(enabled.length, 3);
});

test("listEnabledConnectors does not modify original array [connector-registry]", () => {
  const connectors: ConnectorManifest[] = [
    { connectorId: "slack", provider: "slack", lifecycleState: "enabled" },
    { connectorId: "jira", provider: "jira", lifecycleState: "enabled" },
  ];

  const enabled = listEnabledConnectors(connectors);
  enabled.pop();

  assert.equal(connectors.length, 2, "original array should be unchanged");
});

test("listEnabledConnectors returns readonly input as regular array [connector-registry]", () => {
  const connectors: readonly ConnectorManifest[] = [
    { connectorId: "slack", provider: "slack", lifecycleState: "enabled" },
  ];

  const enabled = listEnabledConnectors(connectors);

  assert.ok(Array.isArray(enabled));
  assert.equal(enabled.length, 1);
});
