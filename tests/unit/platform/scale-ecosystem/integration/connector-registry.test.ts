import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  ConnectorManifestSchema,
  listEnabledConnectors,
  type ConnectorManifest,
} from "../../../../../src/scale-ecosystem/integration/connector-registry/index.js";

test("listEnabledConnectors returns only enabled connectors [connector-registry]", () => {
  const connectors: ConnectorManifest[] = [
    { connectorId: "conn-1", provider: "aws", capabilities: [], lifecycleState: "enabled" },
    { connectorId: "conn-2", provider: "gcp", capabilities: [], lifecycleState: "disabled" },
    { connectorId: "conn-3", provider: "azure", capabilities: [], lifecycleState: "enabled" },
  ];

  const result = listEnabledConnectors(connectors);

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0]!.connectorId, "conn-1");
  assert.strictEqual(result[1]!.connectorId, "conn-3");
});

test("listEnabledConnectors returns empty array when none enabled [connector-registry]", () => {
  const connectors: ConnectorManifest[] = [
    { connectorId: "conn-1", provider: "aws", capabilities: [], lifecycleState: "disabled" },
    { connectorId: "conn-2", provider: "gcp", capabilities: [], lifecycleState: "revoked" },
  ];

  const result = listEnabledConnectors(connectors);

  assert.strictEqual(result.length, 0);
});

test("listEnabledConnectors returns empty array for empty input [connector-registry]", () => {
  const connectors: readonly ConnectorManifest[] = [];

  const result = listEnabledConnectors(connectors);

  assert.strictEqual(result.length, 0);
});

test("ConnectorManifestSchema validates valid manifest [connector-registry]", () => {
  const manifest = {
    connectorId: "conn-1",
    provider: "aws",
    capabilities: ["s3", "ec2"],
    authMode: "oauth2",
    rateLimits: { read: 1000, write: 100 },
    supportedEvents: ["file.created", "file.deleted"],
    lifecycleState: "registered",
  };

  const result = ConnectorManifestSchema.safeParse(manifest);

  assert.strictEqual(result.success, true);
});

test("ConnectorManifestSchema applies default values [connector-registry]", () => {
  const minimalManifest = {
    connectorId: "conn-1",
    provider: "aws",
    lifecycleState: "registered",
  };

  const result = ConnectorManifestSchema.safeParse(minimalManifest);

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.deepStrictEqual(result.data.capabilities, []);
    assert.strictEqual(result.data.authMode, "oauth2");
    assert.deepStrictEqual(result.data.rateLimits, {});
    assert.deepStrictEqual(result.data.supportedEvents, []);
    assert.strictEqual(result.data.lifecycleState, "registered");
  }
});

test("ConnectorManifestSchema rejects empty connectorId [connector-registry]", () => {
  const manifest = {
    connectorId: "",
    provider: "aws",
  };

  const result = ConnectorManifestSchema.safeParse(manifest);

  assert.strictEqual(result.success, false);
});

test("ConnectorManifestSchema rejects empty provider [connector-registry]", () => {
  const manifest = {
    connectorId: "conn-1",
    provider: "",
  };

  const result = ConnectorManifestSchema.safeParse(manifest);

  assert.strictEqual(result.success, false);
});

test("ConnectorManifestSchema rejects invalid lifecycleState [connector-registry]", () => {
  const manifest = {
    connectorId: "conn-1",
    provider: "aws",
    lifecycleState: "invalid",
  };

  const result = ConnectorManifestSchema.safeParse(manifest);

  assert.strictEqual(result.success, false);
});

test("ConnectorManifestSchema allows valid lifecycleState values [connector-registry]", () => {
  const states = ["registered", "configured", "verified", "enabled", "disabled", "revoked"];

  for (const state of states) {
    const manifest = {
      connectorId: "conn-1",
      provider: "aws",
      lifecycleState: state,
    };

    const result = ConnectorManifestSchema.safeParse(manifest);

    assert.strictEqual(result.success, true, `State ${state} should be valid`);
  }
});

test("ConnectorManifestSchema rejects negative rate limits [connector-registry]", () => {
  const manifest = {
    connectorId: "conn-1",
    provider: "aws",
    rateLimits: { read: -1 },
  };

  const result = ConnectorManifestSchema.safeParse(manifest);

  assert.strictEqual(result.success, false);
});

test("listEnabledConnectors filters by exact lifecycleState match [connector-registry]", () => {
  const connectors: ConnectorManifest[] = [
    { connectorId: "conn-1", provider: "aws", capabilities: [], lifecycleState: "enabled" },
    { connectorId: "conn-2", provider: "gcp", capabilities: [], lifecycleState: "configured" },
    { connectorId: "conn-3", provider: "azure", capabilities: [], lifecycleState: "enabled" },
    { connectorId: "conn-4", provider: "custom", capabilities: [], lifecycleState: "verified" },
  ];

  const result = listEnabledConnectors(connectors);

  assert.strictEqual(result.length, 2);
  assert.ok(result.every((c) => c.lifecycleState === "enabled"));
});

test("listEnabledConnectors handles readonly array [connector-registry]", () => {
  const connectors: readonly ConnectorManifest[] = [
    { connectorId: "conn-1", provider: "aws", capabilities: [], lifecycleState: "enabled" },
  ];

  const result = listEnabledConnectors(connectors);

  assert.strictEqual(result.length, 1);
});

test("ConnectorManifestSchema rejects missing connectorId [connector-registry]", () => {
  const manifest = {
    provider: "aws",
  };

  const result = ConnectorManifestSchema.safeParse(manifest);

  assert.strictEqual(result.success, false);
});

test("ConnectorManifestSchema rejects missing provider [connector-registry]", () => {
  const manifest = {
    connectorId: "conn-1",
  };

  const result = ConnectorManifestSchema.safeParse(manifest);

  assert.strictEqual(result.success, false);
});

test("ConnectorManifestSchema allows zero rate limit values [connector-registry]", () => {
  const manifest = {
    connectorId: "conn-1",
    provider: "aws",
    rateLimits: { read: 0 },
    lifecycleState: "registered",
  };

  const result = ConnectorManifestSchema.safeParse(manifest);

  assert.strictEqual(result.success, true);
});
