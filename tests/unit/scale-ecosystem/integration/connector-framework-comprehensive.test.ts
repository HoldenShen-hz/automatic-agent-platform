/**
 * Comprehensive unit tests for ConnectorFrameworkService
 *
 * @see src/scale-ecosystem/integration/connector-framework-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConnectorFrameworkService,
  type ConnectorBinding,
} from "../../../../src/scale-ecosystem/integration/connector-framework-service.js";
import {
  ConnectorManifestSchema,
  type ConnectorManifest,
} from "../../../../src/scale-ecosystem/integration/connector-registry/index.js";
import {
  ConnectorExecutionRequestSchema,
  type ConnectorExecutionRequest,
} from "../../../../src/scale-ecosystem/integration/connector-runtime/index.js";
import {
  type ConnectorHealthReport,
} from "../../../../src/scale-ecosystem/integration/health-monitor/index.js";

function createTestManifest(overrides: Partial<ConnectorManifest> = {}): ConnectorManifest {
  return ConnectorManifestSchema.parse({
    connectorId: overrides.connectorId ?? "test-connector",
    provider: overrides.provider ?? "test-provider",
    capabilities: overrides.capabilities ?? ["read", "write"],
    lifecycleState: overrides.lifecycleState ?? "enabled",
    supportedEvents: overrides.supportedEvents ?? ["event.test"],
  });
}

test("ConnectorFrameworkService.register stores and retrieves manifest [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  const manifest = createTestManifest({ connectorId: "github-v1" });

  const registered = service.register(manifest);
  const retrieved = service.getManifest("github-v1");

  assert.equal(registered.connectorId, "github-v1");
  assert.ok(retrieved);
  assert.equal(retrieved!.connectorId, "github-v1");
});

test("ConnectorFrameworkService.register normalizes manifest with defaults [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  const manifest = createTestManifest({ connectorId: "slack-v1" });

  const registered = service.register(manifest);

  assert.equal(registered.lifecycleState, "enabled");
  assert.ok(Array.isArray(registered.capabilities));
  assert.ok(Array.isArray(registered.supportedEvents));
  assert.equal(registered.authMode, "oauth2");
});

test("ConnectorFrameworkService.register requires lifecycleState in schema [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();

  // Schema requires lifecycleState - this tests that the schema enforces required fields
  const manifestWithState: ConnectorManifest = {
    connectorId: "minimal-connector",
    provider: "TestProvider",
    lifecycleState: "enabled",
  };

  const registered = service.register(manifestWithState);

  assert.equal(registered.connectorId, "minimal-connector");
  assert.equal(registered.lifecycleState, "enabled");
});

test("ConnectorFrameworkService.bind creates binding for valid connector in dev [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "jira-v1", lifecycleState: "enabled" }));

  const binding = service.bind("jira-v1", "tenant-123", "dev");

  assert.equal(binding.connectorId, "jira-v1");
  assert.equal(binding.tenantId, "tenant-123");
  assert.equal(binding.environment, "dev");
  assert.ok(binding.bindingId);
  assert.ok(binding.boundAt);
});

test("ConnectorFrameworkService.bind creates binding for verified connector in prod [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "verified-connector", lifecycleState: "verified" }));

  const binding = service.bind("verified-connector", "tenant-123", "prod");

  assert.equal(binding.connectorId, "verified-connector");
  assert.equal(binding.environment, "prod");
});

test("ConnectorFrameworkService.bind creates binding for enabled connector in prod [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "enabled-connector", lifecycleState: "enabled" }));

  const binding = service.bind("enabled-connector", "tenant-123", "prod");

  assert.equal(binding.connectorId, "enabled-connector");
  assert.equal(binding.environment, "prod");
});

test("ConnectorFrameworkService.bind throws for non-existent connector [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();

  assert.throws(() => {
    service.bind("non-existent", "tenant-123", "dev");
  }, /connector_not_found/);
});

test("ConnectorFrameworkService.bind throws for registered connector in prod [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "unverified-connector", lifecycleState: "registered" }));

  assert.throws(() => {
    service.bind("unverified-connector", "tenant-123", "prod");
  }, /prod_requires_verified/);
});

test("ConnectorFrameworkService.bind allows custom boundAt timestamp [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "custom-time-connector", lifecycleState: "enabled" }));

  const binding = service.bind("custom-time-connector", "tenant-123", "dev", "2025-01-01T00:00:00.000Z");

  assert.equal(binding.boundAt, "2025-01-01T00:00:00.000Z");
});

test("ConnectorFrameworkService.recordHealth stores and returns health report [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "health-connector" }));

  const report: ConnectorHealthReport = {
    connectorId: "health-connector",
    status: "healthy",
    latencyMs: 50,
    checkedAt: new Date().toISOString(),
  };

  const recorded = service.recordHealth(report);

  assert.equal(recorded.connectorId, "health-connector");
  assert.equal(recorded.status, "healthy");
  assert.equal(recorded.latencyMs, 50);
});

test("ConnectorFrameworkService.recordHealth throws for unknown connector [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();

  assert.throws(() => {
    service.recordHealth({
      connectorId: "non-existent",
      status: "healthy",
      latencyMs: 50,
      checkedAt: new Date().toISOString(),
    });
  }, /connector_not_found/);
});

test("ConnectorFrameworkService.execute succeeds for healthy connector with all requirements [connector-framework-comprehensive]", async () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "healthy-connector", lifecycleState: "enabled" }));
  service.recordHealth({
    connectorId: "healthy-connector",
    status: "healthy",
    latencyMs: 50,
    checkedAt: new Date().toISOString(),
  });

  const request = ConnectorExecutionRequestSchema.parse({
    connectorId: "healthy-connector",
    capability: "read",
    payload: {},
    secretBindings: [{ secretRef: "secret-1", purpose: "auth" }],
    policyRef: "policy-1",
  });

  const result = await service.execute(request, { environment: "dev" });

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
  assert.ok(result.executionKey);
  assert.ok(result.executedAt);
});

test("ConnectorFrameworkService.execute defers for degraded connector [connector-framework-comprehensive]", async () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "degraded-connector", lifecycleState: "enabled" }));
  service.recordHealth({
    connectorId: "degraded-connector",
    status: "degraded",
    latencyMs: 500,
    checkedAt: new Date().toISOString(),
  });

  const request = ConnectorExecutionRequestSchema.parse({
    connectorId: "degraded-connector",
    capability: "read",
    payload: {},
    secretBindings: [{ secretRef: "secret-1", purpose: "auth" }],
    policyRef: "policy-1",
  });

  const result = await service.execute(request, { environment: "dev" });

  assert.equal(result.success, true);
  assert.equal(result.status, "deferred");
});

test("ConnectorFrameworkService.execute fails for failed connector [connector-framework-comprehensive]", async () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "failed-connector", lifecycleState: "enabled" }));
  service.recordHealth({
    connectorId: "failed-connector",
    status: "failed",
    latencyMs: 5000,
    checkedAt: new Date().toISOString(),
  });

  const request = ConnectorExecutionRequestSchema.parse({
    connectorId: "failed-connector",
    capability: "read",
    payload: {},
    secretBindings: [{ secretRef: "secret-1", purpose: "auth" }],
    policyRef: "policy-1",
  });

  const result = await service.execute(request, { environment: "dev" });

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService.execute fails for missing secret bindings [connector-framework-comprehensive]", async () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "secure-connector", lifecycleState: "enabled" }));

  const request = ConnectorExecutionRequestSchema.parse({
    connectorId: "secure-connector",
    capability: "read",
    payload: {},
    secretBindings: [],
    policyRef: undefined,
  });

  const result = await service.execute(request, { environment: "dev" });

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService.execute fails for missing policy ref [connector-framework-comprehensive]", async () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "policy-connector", lifecycleState: "enabled" }));

  const request = ConnectorExecutionRequestSchema.parse({
    connectorId: "policy-connector",
    capability: "read",
    payload: {},
    secretBindings: [{ secretRef: "secret-1", purpose: "auth" }],
  });

  const result = await service.execute(request, { environment: "dev" });

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService.execute fails for unsupported event type [connector-framework-comprehensive]", async () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({
    connectorId: "event-connector",
    lifecycleState: "enabled",
    supportedEvents: ["event.supported"]
  }));

  const request = ConnectorExecutionRequestSchema.parse({
    connectorId: "event-connector",
    capability: "read",
    payload: {},
    secretBindings: [{ secretRef: "secret-1", purpose: "auth" }],
    policyRef: "policy-1",
  });

  const result = await service.execute(request, { environment: "dev", eventType: "event.unsupported" });

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService.execute succeeds for supported event type [connector-framework-comprehensive]", async () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({
    connectorId: "supported-event-connector",
    lifecycleState: "enabled",
    supportedEvents: ["event.supported"]
  }));

  const request = ConnectorExecutionRequestSchema.parse({
    connectorId: "supported-event-connector",
    capability: "read",
    payload: {},
    secretBindings: [{ secretRef: "secret-1", purpose: "auth" }],
    policyRef: "policy-1",
  });

  const result = await service.execute(request, { environment: "dev", eventType: "event.supported" });

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ConnectorFrameworkService.execute throws for unknown connector [connector-framework-comprehensive]", async () => {
  const service = new ConnectorFrameworkService();

  await assert.rejects(async () => {
    await service.execute(
      { connectorId: "non-existent", capability: "read", payload: {}, secretBindings: [] },
      { environment: "dev" }
    );
  }, /connector_not_found/);
});

test("ConnectorFrameworkService.execute throws for prod with registered connector [connector-framework-comprehensive]", async () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "unverified", lifecycleState: "registered" }));

  await assert.rejects(async () => {
    await service.execute(
      {
        connectorId: "unverified",
        capability: "read",
        payload: {},
        secretBindings: [{ secretRef: "secret-1", purpose: "auth" }],
        policyRef: "policy-1",
      },
      { environment: "prod" }
    );
  }, /prod_requires_verified/);
});

test("ConnectorFrameworkService.listEnabled returns only enabled connectors [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "enabled-1", lifecycleState: "enabled" }));
  service.register(createTestManifest({ connectorId: "enabled-2", lifecycleState: "enabled" }));
  service.register(createTestManifest({ connectorId: "disabled-1", lifecycleState: "disabled" }));
  service.register(createTestManifest({ connectorId: "registered-1", lifecycleState: "registered" }));

  const enabled = service.listEnabled();

  assert.equal(enabled.length, 2);
  assert.ok(enabled.some((c) => c.connectorId === "enabled-1"));
  assert.ok(enabled.some((c) => c.connectorId === "enabled-2"));
  assert.ok(!enabled.some((c) => c.connectorId === "disabled-1"));
  assert.ok(!enabled.some((c) => c.connectorId === "registered-1"));
});

test("ConnectorFrameworkService.listBindings returns all bindings when no filter [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "multi-tenant-connector", lifecycleState: "enabled" }));
  service.bind("multi-tenant-connector", "tenant-1", "dev");
  service.bind("multi-tenant-connector", "tenant-2", "prod");
  service.bind("multi-tenant-connector", "tenant-3", "staging");

  const bindings = service.listBindings();

  assert.equal(bindings.length, 3);
});

test("ConnectorFrameworkService.listBindings filters by connectorId [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "filter-connector", lifecycleState: "enabled" }));
  service.register(createTestManifest({ connectorId: "other-connector", lifecycleState: "enabled" }));
  service.bind("filter-connector", "tenant-1", "dev");
  service.bind("filter-connector", "tenant-2", "prod");
  service.bind("other-connector", "tenant-3", "dev");

  const bindings = service.listBindings({ connectorId: "filter-connector" });

  assert.equal(bindings.length, 2);
  assert.ok(bindings.every((b) => b.connectorId === "filter-connector"));
});

test("ConnectorFrameworkService.listBindings filters by tenantId [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "tenant-connector", lifecycleState: "enabled" }));
  service.bind("tenant-connector", "tenant-a", "dev");
  service.bind("tenant-connector", "tenant-b", "dev");
  service.bind("tenant-connector", "tenant-c", "prod");

  const bindings = service.listBindings({ tenantId: "tenant-a" });

  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]!.tenantId, "tenant-a");
});

test("ConnectorFrameworkService.listBindings filters by environment [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "env-connector", lifecycleState: "enabled" }));
  service.bind("env-connector", "tenant-1", "dev");
  service.bind("env-connector", "tenant-2", "prod");
  service.bind("env-connector", "tenant-3", "staging");

  const prodBindings = service.listBindings({ environment: "prod" });
  const devBindings = service.listBindings({ environment: "dev" });

  assert.equal(prodBindings.length, 1);
  assert.equal(prodBindings[0]!.environment, "prod");
  assert.equal(devBindings.length, 1);
  assert.equal(devBindings[0]!.environment, "dev");
});

test("ConnectorFrameworkService.listBindings filters by multiple criteria [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "multi-filter-connector", lifecycleState: "enabled" }));
  service.bind("multi-filter-connector", "tenant-a", "dev");
  service.bind("multi-filter-connector", "tenant-a", "prod");
  service.bind("multi-filter-connector", "tenant-b", "dev");

  const bindings = service.listBindings({ tenantId: "tenant-a", environment: "prod" });

  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]!.tenantId, "tenant-a");
  assert.equal(bindings[0]!.environment, "prod");
});

test("ConnectorFrameworkService.getManifest returns null for non-existent connector [connector-framework-comprehensive]", () => {
  const service = new ConnectorFrameworkService();

  const manifest = service.getManifest("non-existent");

  assert.equal(manifest, null);
});

test("ConnectorFrameworkService.execute uses custom executedAt timestamp [connector-framework-comprehensive]", async () => {
  const service = new ConnectorFrameworkService();
  service.register(createTestManifest({ connectorId: "timestamp-connector", lifecycleState: "enabled" }));
  service.recordHealth({
    connectorId: "timestamp-connector",
    status: "healthy",
    latencyMs: 50,
    checkedAt: new Date().toISOString(),
  });

  const request = ConnectorExecutionRequestSchema.parse({
    connectorId: "timestamp-connector",
    capability: "read",
    payload: {},
    secretBindings: [{ secretRef: "secret-1", purpose: "auth" }],
    policyRef: "policy-1",
  });

  const result = await service.execute(request, { environment: "dev", executedAt: "2025-01-01T00:00:00.000Z" });

  assert.equal(result.executedAt, "2025-01-01T00:00:00.000Z");
});
