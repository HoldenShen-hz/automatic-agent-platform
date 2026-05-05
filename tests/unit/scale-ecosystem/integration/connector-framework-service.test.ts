import assert from "node:assert/strict";
import test from "node:test";

import { ConnectorFrameworkService } from "../../../../src/scale-ecosystem/integration/connector-framework-service.js";
import type { ConnectorManifest } from "../../../../src/scale-ecosystem/integration/connector-registry/index.js";
import type { ConnectorHealthReport } from "../../../../src/scale-ecosystem/integration/health-monitor/index.js";

test("ConnectorFrameworkService registers a connector manifest", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1", "cap2"],
    authMode: "oauth2",
    rateLimits: { requests: 100 },
    supportedEvents: ["event1"],
    lifecycleState: "registered",
  };

  const registered = service.register(manifest);
  assert.equal(registered.connectorId, "test-connector");
  assert.equal(registered.provider, "TestProvider");
});

test("ConnectorFrameworkService binds a connector to a tenant", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  const binding = service.bind("test-connector", "tenant-1", "dev", "2026-01-01T00:00:00.000Z");
  assert.equal(binding.connectorId, "test-connector");
  assert.equal(binding.tenantId, "tenant-1");
  assert.equal(binding.environment, "dev");
});

test("ConnectorFrameworkService bind throws for prod with non-verified connector", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "registered",
  };
  service.register(manifest);

  assert.throws(
    () => service.bind("test-connector", "tenant-1", "prod"),
    /connector_framework.prod_requires_verified/,
  );
});

test("ConnectorFrameworkService bind allows prod with verified connector", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "verified",
  };
  service.register(manifest);

  const binding = service.bind("test-connector", "tenant-1", "prod");
  assert.equal(binding.environment, "prod");
});

test("ConnectorFrameworkService bind allows prod with enabled connector", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  const binding = service.bind("test-connector", "tenant-1", "prod");
  assert.equal(binding.environment, "prod");
});

test("ConnectorFrameworkService records health reports", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  const report: ConnectorHealthReport = {
    connectorId: "test-connector",
    status: "healthy",
    latencyMs: 50,
    checkedAt: "2026-01-01T00:00:00.000Z",
  };

  const recorded = service.recordHealth(report);
  assert.equal(recorded.connectorId, "test-connector");
  assert.equal(recorded.status, "healthy");
});

test("ConnectorFrameworkService execute returns success for healthy connector", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "enabled",
  };
  service.register(manifest);
  service.registerExecutor("test-connector", ({ request }) => ({
    connectorId: request.connectorId,
    success: true,
    status: "succeeded",
  }));

  const result = service.execute(
    {
      connectorId: "test-connector",
      capability: "cap1",
      payload: {},
      policyRef: "policy.connector.test",
      secretBindings: [{ secretRef: "secret://test-connector/token", purpose: "api_token" }],
    },
    { environment: "dev" },
  );

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ConnectorFrameworkService execute returns failed for unsupported event", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    supportedEvents: ["supported_event"],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  const result = service.execute(
    {
      connectorId: "test-connector",
      capability: "cap1",
      payload: {},
      policyRef: "policy.connector.test",
      secretBindings: [{ secretRef: "secret://test-connector/token", purpose: "api_token" }],
    },
    { environment: "dev", eventType: "unsupported_event" },
  );

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService execute returns failed for unhealthy connector", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  service.recordHealth({
    connectorId: "test-connector",
    status: "failed",
    latencyMs: 1000,
    checkedAt: "2026-01-01T00:00:00.000Z",
  });

  const result = service.execute(
    {
      connectorId: "test-connector",
      capability: "cap1",
      payload: {},
      policyRef: "policy.connector.test",
      secretBindings: [{ secretRef: "secret://test-connector/token", purpose: "api_token" }],
    },
    { environment: "dev" },
  );

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService execute fails closed for degraded connector without executor", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  service.recordHealth({
    connectorId: "test-connector",
    status: "degraded",
    latencyMs: 500,
    checkedAt: "2026-01-01T00:00:00.000Z",
  });

  const result = service.execute(
    {
      connectorId: "test-connector",
      capability: "cap1",
      payload: {},
      policyRef: "policy.connector.test",
      secretBindings: [{ secretRef: "secret://test-connector/token", purpose: "api_token" }],
    },
    { environment: "dev" },
  );

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService execute invokes registered executor and records executor-backed result", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "executor-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  const seenCapabilities: string[] = [];
  service.registerExecutor("executor-connector", ({ request, executionKey }) => {
    seenCapabilities.push(`${request.capability}:${executionKey}`);
    return {
      connectorId: request.connectorId,
      success: true,
      status: "succeeded",
    };
  });

  const result = service.execute(
    {
      connectorId: "executor-connector",
      capability: "cap1",
      payload: {},
      policyRef: "policy.connector.test",
      secretBindings: [{ secretRef: "secret://executor-connector/token", purpose: "api_token" }],
    },
    { environment: "dev", executedAt: "2026-01-02T00:00:00.000Z" },
  );

  assert.equal(result.success, true);
  assert.equal(seenCapabilities.length, 1);

  const records = service.listExecutionRecords("executor-connector");
  assert.equal(records.length, 1);
  assert.equal(records[0]?.mode, "executor");
  assert.equal(records[0]?.executedAt, "2026-01-02T00:00:00.000Z");
  assert.equal(records[0]?.sideEffectStatus, "confirmed");
});

test("ConnectorFrameworkService auto-wires builtin providers to concrete connector executors", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "slack-primary",
    provider: "slack",
    capabilities: ["send_message"],
    supportedEvents: ["incident.opened"],
    lifecycleState: "enabled",
  });

  const result = service.execute(
    {
      connectorId: "slack-primary",
      capability: "send_message",
      payload: { channel: "#ops", message: "hello" },
      policyRef: "policy.connector.slack-primary",
      secretBindings: [{ secretRef: "secret://slack-primary/token", purpose: "bot_token" }],
    },
    { environment: "prod", eventType: "incident.opened" },
  );

  assert.equal(result.success, true);

  const [record] = service.listExecutionRecords("slack-primary");
  assert.equal(record?.mode, "executor");
});

test("ConnectorFrameworkService records reconciled side effects for connector executions", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "side-effect-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "enabled",
  });
  service.registerExecutor("side-effect-connector", ({ request }) => ({
    connectorId: request.connectorId,
    success: true,
    status: "succeeded",
  }));

  service.execute(
    {
      connectorId: "side-effect-connector",
      capability: "cap1",
      payload: {},
      policyRef: "policy.connector.side-effect-connector",
      secretBindings: [{ secretRef: "secret://side-effect-connector/token", purpose: "api_token" }],
    },
    { environment: "dev", executedAt: "2026-01-03T00:00:00.000Z" },
  );

  const [sideEffectRecord] = service.listSideEffectRecords("side-effect-connector");
  assert.equal(sideEffectRecord?.sideEffect.status, "confirmed");
  assert.equal(sideEffectRecord?.reconciliation.nextAction, "mark_confirmed");
  assert.ok(sideEffectRecord?.transitionEventType.length);
});

test("ConnectorFrameworkService execute fails closed for connectors without executor and records synthesized failure", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "synth-fallback-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  const result = service.execute(
    {
      connectorId: "synth-fallback-connector",
      capability: "cap1",
      payload: {},
      policyRef: "policy.connector.test",
      secretBindings: [{ secretRef: "secret://synth-fallback-connector/token", purpose: "api_token" }],
    },
    { environment: "dev" },
  );

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");

  const records = service.listExecutionRecords("synth-fallback-connector");
  assert.equal(records.length, 1);
  assert.equal(records[0]?.mode, "synthesized");
  assert.equal(records[0]?.success, false);
  assert.equal(records[0]?.status, "failed");
  assert.equal(records[0]?.sideEffectStatus, "failed");
});

test("ConnectorFrameworkService execute throws for prod with non-verified connector", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "registered",
  };
  service.register(manifest);

  assert.throws(
    () =>
      service.execute(
        {
          connectorId: "test-connector",
          capability: "cap1",
          payload: {},
          policyRef: "policy.connector.test",
          secretBindings: [{ secretRef: "secret://test-connector/token", purpose: "api_token" }],
        },
        { environment: "prod" },
      ),
    /connector_framework.prod_requires_verified/,
  );
});

test("ConnectorFrameworkService execute fails closed when policyRef or secret bindings are missing", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "enabled",
  });

  const withoutPolicy = service.execute(
    {
      connectorId: "test-connector",
      capability: "cap1",
      payload: {},
      secretBindings: [{ secretRef: "secret://test-connector/token", purpose: "api_token" }],
    },
    { environment: "dev" },
  );
  const withoutSecret = service.execute(
    {
      connectorId: "test-connector",
      capability: "cap1",
      payload: {},
      policyRef: "policy.connector.test",
    },
    { environment: "dev" },
  );

  assert.equal(withoutPolicy.success, false);
  assert.equal(withoutPolicy.status, "failed");
  assert.equal(withoutSecret.success, false);
  assert.equal(withoutSecret.status, "failed");
});

test("ConnectorFrameworkService execute throws for unknown connector", () => {
  const service = new ConnectorFrameworkService();

  assert.throws(
    () =>
      service.execute(
        { connectorId: "unknown-connector", capability: "cap1", payload: {} },
        { environment: "dev" },
      ),
    /connector_framework.connector_not_found/,
  );
});

test("ConnectorFrameworkService listEnabled returns enabled connectors", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "enabled-connector",
    provider: "Provider1",
    capabilities: [],
    lifecycleState: "enabled",
  });
  service.register({
    connectorId: "disabled-connector",
    provider: "Provider2",
    capabilities: [],
    lifecycleState: "disabled",
  });
  service.register({
    connectorId: "registered-connector",
    provider: "Provider3",
    capabilities: [],
    lifecycleState: "registered",
  });

  const enabled = service.listEnabled();
  assert.equal(enabled.length, 1);
  assert.equal(enabled[0]!.connectorId, "enabled-connector");
});

test("ConnectorFrameworkService getManifest returns registered manifest", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  const found = service.getManifest("test-connector");
  assert.ok(found != null);
  assert.equal(found!.connectorId, "test-connector");
});

test("ConnectorFrameworkService getManifest returns null for unknown connector", () => {
  const service = new ConnectorFrameworkService();

  const found = service.getManifest("unknown-connector");
  assert.equal(found, null);
});

test("ConnectorFrameworkService listBindings filters by connectorId", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };
  service.register(manifest);
  service.register({
    ...manifest,
    connectorId: "other-connector",
  });

  service.bind("test-connector", "tenant-1", "dev");
  service.bind("test-connector", "tenant-2", "dev");
  service.bind("other-connector", "tenant-3", "dev");

  const bindings = service.listBindings({ connectorId: "test-connector" });
  assert.equal(bindings.length, 2);
  assert.ok(bindings.every((b) => b.connectorId === "test-connector"));
});

test("ConnectorFrameworkService listBindings filters by tenantId", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  service.bind("test-connector", "tenant-1", "dev");
  service.bind("test-connector", "tenant-2", "dev");

  const bindings = service.listBindings({ tenantId: "tenant-1" });
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]!.tenantId, "tenant-1");
});

test("ConnectorFrameworkService listBindings filters by environment", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  service.bind("test-connector", "tenant-1", "dev");
  service.bind("test-connector", "tenant-2", "prod");

  const devBindings = service.listBindings({ environment: "dev" });
  const prodBindings = service.listBindings({ environment: "prod" });

  assert.equal(devBindings.length, 1);
  assert.equal(devBindings[0]!.environment, "dev");
  assert.equal(prodBindings.length, 1);
  assert.equal(prodBindings[0]!.environment, "prod");
});

test("ConnectorFrameworkService bind throws for unknown connector", () => {
  const service = new ConnectorFrameworkService();

  assert.throws(
    () => service.bind("unknown-connector", "tenant-1", "dev"),
    /connector_framework.connector_not_found/,
  );
});

test("ConnectorFrameworkService recordHealth throws for unknown connector", () => {
  const service = new ConnectorFrameworkService();

  assert.throws(
    () =>
      service.recordHealth({
        connectorId: "unknown-connector",
        status: "healthy",
        latencyMs: 50,
        checkedAt: "2026-01-01T00:00:00.000Z",
      }),
    /connector_framework.connector_not_found/,
  );
});
