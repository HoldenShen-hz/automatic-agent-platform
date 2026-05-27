import assert from "node:assert/strict";
import test from "node:test";

import {
  ConnectorManifestSchema,
} from "../../../../src/scale-ecosystem/integration/connector-registry/index.js";

test("ConnectorManifestSchema parses valid manifest with all fields [connector-registry-schemas]", () => {
  const result = ConnectorManifestSchema.parse({
    connectorId: "slack-connector",
    provider: "Slack Inc",
    capabilities: ["messaging", "channels", "webhooks"],
    authMode: "oauth2",
    rateLimits: { perMinute: 100, perHour: 5000 },
    supportedEvents: ["message.created", "channel.updated"],
    lifecycleState: "enabled",
  });

  assert.equal(result.connectorId, "slack-connector");
  assert.equal(result.provider, "Slack Inc");
  assert.deepEqual(result.capabilities, ["messaging", "channels", "webhooks"]);
  assert.equal(result.authMode, "oauth2");
  assert.deepEqual(result.rateLimits, { perMinute: 100, perHour: 5000 });
  assert.deepEqual(result.supportedEvents, ["message.created", "channel.updated"]);
  assert.equal(result.lifecycleState, "enabled");
});

test("ConnectorManifestSchema parses manifest with minimal fields [connector-registry-schemas]", () => {
  const result = ConnectorManifestSchema.parse({
    connectorId: "minimal-connector",
    provider: "Minimal Corp",
    lifecycleState: "registered",
  });

  assert.equal(result.connectorId, "minimal-connector");
  assert.equal(result.provider, "Minimal Corp");
  assert.deepEqual(result.capabilities, []);
  assert.equal(result.authMode, "oauth2");
  assert.deepEqual(result.rateLimits, {});
  assert.deepEqual(result.supportedEvents, []);
});

test("ConnectorManifestSchema accepts all lifecycle states [connector-registry-schemas]", () => {
  const states = ["registered", "configured", "verified", "enabled", "disabled", "revoked"] as const;

  for (const lifecycleState of states) {
    const result = ConnectorManifestSchema.parse({
      connectorId: `connector-${lifecycleState}`,
      provider: "Test Provider",
      lifecycleState,
    });
    assert.equal(result.lifecycleState, lifecycleState);
  }
});

test("ConnectorManifestSchema rejects missing connectorId [connector-registry-schemas]", () => {
  assert.throws(() => {
    ConnectorManifestSchema.parse({
      provider: "Test Provider",
      lifecycleState: "registered",
    });
  });
});

test("ConnectorManifestSchema rejects empty connectorId [connector-registry-schemas]", () => {
  assert.throws(() => {
    ConnectorManifestSchema.parse({
      connectorId: "",
      provider: "Test Provider",
      lifecycleState: "registered",
    });
  });
});

test("ConnectorManifestSchema rejects missing provider [connector-registry-schemas]", () => {
  assert.throws(() => {
    ConnectorManifestSchema.parse({
      connectorId: "test-connector",
      lifecycleState: "registered",
    });
  });
});

test("ConnectorManifestSchema rejects empty provider [connector-registry-schemas]", () => {
  assert.throws(() => {
    ConnectorManifestSchema.parse({
      connectorId: "test-connector",
      provider: "",
      lifecycleState: "registered",
    });
  });
});

test("ConnectorManifestSchema rejects invalid lifecycleState [connector-registry-schemas]", () => {
  assert.throws(() => {
    ConnectorManifestSchema.parse({
      connectorId: "test-connector",
      provider: "Test Provider",
      lifecycleState: "active",
    });
  });
});

test("ConnectorManifestSchema rejects negative rateLimit values [connector-registry-schemas]", () => {
  assert.throws(() => {
    ConnectorManifestSchema.parse({
      connectorId: "test-connector",
      provider: "Test Provider",
      rateLimits: { perMinute: -1 },
      lifecycleState: "registered",
    });
  });
});

test("ConnectorManifestSchema accepts zero rateLimit values [connector-registry-schemas]", () => {
  const result = ConnectorManifestSchema.parse({
    connectorId: "test-connector",
    provider: "Test Provider",
    rateLimits: { perMinute: 0 },
    lifecycleState: "registered",
  });

  assert.equal(result.rateLimits.perMinute, 0);
});

test("ConnectorManifestSchema accepts different authMode values [connector-registry-schemas]", () => {
  const authModes = ["oauth2", "apikey", "basic", "bearer", "custom"] as const;

  for (const authMode of authModes) {
    const result = ConnectorManifestSchema.parse({
      connectorId: `connector-${authMode}`,
      provider: "Test Provider",
      authMode,
      lifecycleState: "registered",
    });
    assert.equal(result.authMode, authMode);
  }
});

test("ConnectorManifestSchema accepts any string as authMode (no enum validation) [connector-registry-schemas]", () => {
  // authMode is z.string() not z.enum(), so any string is accepted
  const result = ConnectorManifestSchema.parse({
    connectorId: "test-connector",
    provider: "Test Provider",
    authMode: "unknown_auth",
    lifecycleState: "registered",
  });
  assert.equal(result.authMode, "unknown_auth");
});

test("ConnectorManifestSchema default capabilities is empty array [connector-registry-schemas]", () => {
  const result = ConnectorManifestSchema.parse({
    connectorId: "test-connector",
    provider: "Test Provider",
    lifecycleState: "registered",
  });

  assert.deepEqual(result.capabilities, []);
});

test("ConnectorManifestSchema default rateLimits is empty object [connector-registry-schemas]", () => {
  const result = ConnectorManifestSchema.parse({
    connectorId: "test-connector",
    provider: "Test Provider",
    lifecycleState: "registered",
  });

  assert.deepEqual(result.rateLimits, {});
});

test("ConnectorManifestSchema default supportedEvents is empty array [connector-registry-schemas]", () => {
  const result = ConnectorManifestSchema.parse({
    connectorId: "test-connector",
    provider: "Test Provider",
    lifecycleState: "registered",
  });

  assert.deepEqual(result.supportedEvents, []);
});
