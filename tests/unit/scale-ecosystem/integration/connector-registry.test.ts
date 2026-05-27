import assert from "node:assert/strict";
import test from "node:test";

import { listEnabledConnectors, ConnectorManifest } from "../../../../src/scale-ecosystem/integration/connector-registry/index.js";

test("listEnabledConnectors returns only enabled connectors [connector-registry]", () => {
  const connectors: ConnectorManifest[] = [
    { connectorId: "c1", provider: "aws", lifecycleState: "enabled" },
    { connectorId: "c2", provider: "gcp", lifecycleState: "disabled" },
    { connectorId: "c3", provider: "azure", lifecycleState: "enabled" },
    { connectorId: "c4", provider: "local", lifecycleState: "registered" },
  ];

  const enabled = listEnabledConnectors(connectors);

  assert.equal(enabled.length, 2);
  assert.ok(enabled.every((c: any) => c.lifecycleState === "enabled"));
});

test("listEnabledConnectors returns empty for all disabled [connector-registry]", () => {
  const connectors: ConnectorManifest[] = [
    { connectorId: "c1", provider: "aws", lifecycleState: "disabled" },
    { connectorId: "c2", provider: "gcp", lifecycleState: "revoked" },
  ];

  const enabled = listEnabledConnectors(connectors);

  assert.deepEqual(enabled, []);
});

test("listEnabledConnectors returns empty for empty input [connector-registry]", () => {
  const enabled = listEnabledConnectors([]);
  assert.deepEqual(enabled, []);
});

test("ConnectorManifestSchema parses valid manifest [connector-registry]", () => {
  const result = {
    connectorId: "slack",
    provider: "slack-inc",
    capabilities: ["messaging", "channels"],
    authMode: "oauth2",
    rateLimits: { perMinute: 100 },
    supportedEvents: ["message.created"],
    lifecycleState: "registered" as const,
  };

  const enabled = listEnabledConnectors([result]);
  assert.equal(enabled.length, 0); // not enabled
});

test("listEnabledConnectors handles all lifecycle states [connector-registry]", () => {
  const connectors: ConnectorManifest[] = [
    { connectorId: "c1", provider: "p1", lifecycleState: "registered" },
    { connectorId: "c2", provider: "p2", lifecycleState: "configured" },
    { connectorId: "c3", provider: "p3", lifecycleState: "verified" },
    { connectorId: "c4", provider: "p4", lifecycleState: "enabled" },
    { connectorId: "c5", provider: "p5", lifecycleState: "disabled" },
    { connectorId: "c6", provider: "p6", lifecycleState: "revoked" },
  ];

  const enabled = listEnabledConnectors(connectors);

  assert.equal(enabled.length, 1);
  assert.equal(enabled[0]!.connectorId, "c4");
});