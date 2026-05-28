import assert from "node:assert/strict";
import test from "node:test";

import { ConnectorFrameworkService } from "../../../../src/scale-ecosystem/integration/connector-framework-service.js";
import type { ConnectorManifest } from "../../../../src/scale-ecosystem/integration/connector-registry/index.js";
import type { ConnectorHealthReport } from "../../../../src/scale-ecosystem/integration/health-monitor/index.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("ConnectorFrameworkService registers a connector manifest [connector-framework-service]", () => {
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

test("ConnectorFrameworkService rejects duplicate connector registration [connector-framework-service]", () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };

  service.register(manifest);
  assert.throws(() => service.register(manifest), /connector_framework.duplicate_connector_id/);
});

test("ConnectorFrameworkService binds a connector to a tenant [connector-framework-service]", () => {
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

test("ConnectorFrameworkService bind throws for prod with non-verified connector [connector-framework-service]", () => {
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

test("ConnectorFrameworkService bind allows prod with verified connector [connector-framework-service]", () => {
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

test("ConnectorFrameworkService bind allows prod with enabled connector [connector-framework-service]", () => {
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

test("ConnectorFrameworkService records health reports [connector-framework-service]", () => {
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

test("ConnectorFrameworkService execute returns success for healthy connector [connector-framework-service]", async () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  const result = await service.execute(
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

test("ConnectorFrameworkService execute returns failed for unsupported event [connector-framework-service]", async () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    supportedEvents: ["supported_event"],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  const result = await service.execute(
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

test("ConnectorFrameworkService execute returns failed for unhealthy connector [connector-framework-service]", async () => {
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

  const result = await service.execute(
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

test("ConnectorFrameworkService execute returns deferred for degraded connector [connector-framework-service]", async () => {
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

  const result = await service.execute(
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
  assert.equal(result.status, "deferred");
});

test("ConnectorFrameworkService execute throws for prod with non-verified connector [connector-framework-service]", async () => {
  const service = new ConnectorFrameworkService();
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "registered",
  };
  service.register(manifest);

  await assert.rejects(
    async () =>
      await service.execute(
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

test("ConnectorFrameworkService execute fails closed when policyRef or secret bindings are missing [connector-framework-service]", async () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: ["cap1"],
    lifecycleState: "enabled",
  });

  const withoutPolicy = await service.execute(
    {
      connectorId: "test-connector",
      capability: "cap1",
      payload: {},
      secretBindings: [{ secretRef: "secret://test-connector/token", purpose: "api_token" }],
    },
    { environment: "dev" },
  );
  const withoutSecret = await service.execute(
    {
      connectorId: "test-connector",
      capability: "cap1",
      payload: {},
      secretBindings: [],
      policyRef: "policy.connector.test",
    },
    { environment: "dev" },
  );

  assert.equal(withoutPolicy.success, false);
  assert.equal(withoutPolicy.status, "failed");
  assert.equal(withoutSecret.success, false);
  assert.equal(withoutSecret.status, "failed");
});

test("ConnectorFrameworkService execute throws for unknown connector [connector-framework-service]", async () => {
  const service = new ConnectorFrameworkService();

  await assert.rejects(
    async () =>
      await service.execute(
        { connectorId: "unknown-connector", capability: "cap1", payload: {}, secretBindings: [] },
        { environment: "dev" },
      ),
    /connector_framework.connector_not_found/,
  );
});

test("ConnectorFrameworkService listEnabled returns enabled connectors [connector-framework-service]", () => {
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

test("ConnectorFrameworkService getManifest returns registered manifest [connector-framework-service]", () => {
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

test("ConnectorFrameworkService getManifest returns null for unknown connector [connector-framework-service]", () => {
  const service = new ConnectorFrameworkService();

  const found = service.getManifest("unknown-connector");
  assert.equal(found, null);
});

test("ConnectorFrameworkService listBindings filters by connectorId [connector-framework-service]", () => {
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

test("ConnectorFrameworkService listBindings filters by tenantId [connector-framework-service]", () => {
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

test("ConnectorFrameworkService listBindings filters by environment [connector-framework-service]", () => {
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

test("ConnectorFrameworkService bind throws for unknown connector [connector-framework-service]", () => {
  const service = new ConnectorFrameworkService();

  assert.throws(
    () => service.bind("unknown-connector", "tenant-1", "dev"),
    /connector_framework.connector_not_found/,
  );
});

test("ConnectorFrameworkService recordHealth throws for unknown connector [connector-framework-service]", () => {
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

test("ConnectorFrameworkService bind evicts bindings older than maxBindingAgeMs [connector-framework-service]", () => {
  // Use a 7-day max age for the test
  const service = new ConnectorFrameworkService(null, 7 * 24 * 60 * 60 * 1000, 100);
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  // Bind with a date 10 days in the past
  const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  service.bind("test-connector", "tenant-old", "dev", oldDate);

  // Bind with current date
  service.bind("test-connector", "tenant-new", "dev");

  const bindings = service.listBindings({ connectorId: "test-connector" });
  // Only the new binding should remain
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]!.tenantId, "tenant-new");
});

test("ConnectorFrameworkService bind respects maxBindingAgeMs on every bind call [connector-framework-service]", () => {
  // 7-day max age
  const service = new ConnectorFrameworkService(null, 7 * 24 * 60 * 60 * 1000, 100);
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  // Add a binding from 8 days ago (should be evicted)
  const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  service.bind("test-connector", "tenant-old", "dev", oldDate);

  // Add a binding from 6 days ago (should be kept)
  const recentDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
  service.bind("test-connector", "tenant-recent", "dev", recentDate);

  // Add a binding now
  service.bind("test-connector", "tenant-new", "dev");

  const bindings = service.listBindings({ connectorId: "test-connector" });
  // The 8-day old binding should be gone; 6-day old and new remain
  assert.equal(bindings.length, 2);
  const tenantIds = bindings.map((b) => b.tenantId);
  assert.ok(tenantIds.includes("tenant-recent"));
  assert.ok(tenantIds.includes("tenant-new"));
  assert.ok(!tenantIds.includes("tenant-old"));
});

test("ConnectorFrameworkService health eviction respects healthRetentionCount [connector-framework-service]", () => {
  const service = new ConnectorFrameworkService(null, 30 * 24 * 60 * 60 * 1000, 5);
  const manifest: ConnectorManifest = {
    connectorId: "test-connector",
    provider: "TestProvider",
    capabilities: [],
    lifecycleState: "enabled",
  };
  service.register(manifest);

  // Record 10 health reports (retention is 5)
  for (let i = 0; i < 10; i++) {
    service.recordHealth({
      connectorId: "test-connector",
      status: "healthy",
      latencyMs: 50 + i,
      checkedAt: new Date(Date.now() + i * 1000).toISOString(),
    });
  }

  // Only the last 5 reports should be retained
  const reports = service["health"].get("test-connector") ?? [];
  assert.equal(reports.length, 5);
});

test("ConnectorFrameworkService loadBindings applies eviction to persisted data [connector-framework-service]", async () => {
  const path = createTempWorkspace("aa-connector-framework-");
  try {
    const service1 = new ConnectorFrameworkService(path, 7 * 24 * 60 * 60 * 1000, 100);
    const manifest: ConnectorManifest = {
      connectorId: "test-connector",
      provider: "TestProvider",
      capabilities: [],
      lifecycleState: "enabled",
    };
    service1.register(manifest);

    // Add an old binding (10 days ago) and a new binding
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    service1.bind("test-connector", "tenant-old", "dev", oldDate);
    service1.bind("test-connector", "tenant-new", "dev");

    // Simulate loading from persisted state
    const service2 = new ConnectorFrameworkService(path, 7 * 24 * 60 * 60 * 1000, 100);
    const bindings = service2.listBindings({ connectorId: "test-connector" });
    // Only the new binding should survive load + eviction
    assert.equal(bindings.length, 1);
    assert.equal(bindings[0]!.tenantId, "tenant-new");
  } finally {
    cleanupPath(path);
  }
});
