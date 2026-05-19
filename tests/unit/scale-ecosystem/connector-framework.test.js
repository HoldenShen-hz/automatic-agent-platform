import assert from "node:assert/strict";
import test from "node:test";
import { ConnectorFrameworkService } from "../../../src/scale-ecosystem/integration/connector-framework-service.js";
import { ConnectorManifestSchema } from "../../../src/scale-ecosystem/integration/connector-registry/index.js";

test("ConnectorFrameworkService.register parses and stores manifest", () => {
  const service = new ConnectorFrameworkService();
  const manifest = ConnectorManifestSchema.parse({
    connectorId: "crm_sync",
    provider: "crm_provider",
    capabilities: ["sync", "read", "write"],
    authMode: "oauth2",
    lifecycleState: "registered",
  });
  const registered = service.register(manifest);
  assert.equal(registered.connectorId, "crm_sync");
  const retrieved = service.getManifest("crm_sync");
  assert.equal(retrieved?.connectorId, "crm_sync");
});

test("ConnectorFrameworkService.register normalizes manifest fields", () => {
  const service = new ConnectorFrameworkService();
  const manifest = { connectorId: "test_connector", provider: "test" };
  const registered = service.register(manifest);
  assert.equal(registered.lifecycleState, "registered");
  assert.ok(Array.isArray(registered.capabilities));
  assert.ok(Array.isArray(registered.supportedEvents));
});

test("ConnectorFrameworkService.bind creates binding for connector", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm_provider",
    lifecycleState: "enabled",
  });
  const binding = service.bind("crm_sync", "tenant_1", "dev", "2026-04-20T00:00:00.000Z");
  assert.equal(binding.connectorId, "crm_sync");
  assert.equal(binding.tenantId, "tenant_1");
  assert.equal(binding.environment, "dev");
});

test("ConnectorFrameworkService.bind throws for prod with non-verified connector", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm_provider",
    lifecycleState: "registered",
  });
  assert.throws(() => {
    service.bind("crm_sync", "tenant_1", "prod", "2026-04-20T00:00:00.000Z");
  }, (err) => err.message.includes("prod_requires_verified"));
});

test("ConnectorFrameworkService.bind allows prod binding for verified connector", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm_provider",
    lifecycleState: "verified",
  });
  const binding = service.bind("crm_sync", "tenant_1", "prod", "2026-04-20T00:00:00.000Z");
  assert.equal(binding.environment, "prod");
});

test("ConnectorFrameworkService.recordHealth stores health report", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm_provider",
    lifecycleState: "enabled",
  });
  const report = {
    connectorId: "crm_sync",
    status: "healthy",
    latencyMs: 50,
    checkedAt: "2026-04-20T00:00:00.000Z",
  };
  const recorded = service.recordHealth(report);
  assert.equal(recorded.connectorId, "crm_sync");
  assert.equal(recorded.status, "healthy");
});

test("ConnectorFrameworkService.execute returns failed for missing secrets", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm_provider",
    lifecycleState: "enabled",
  });
  const result = service.execute({
    connectorId: "crm_sync",
    capability: "sync",
    payload: {},
    secretBindings: [],
    policyRef: null,
  }, { environment: "dev" });
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService.execute returns failed for missing policyRef", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm_provider",
    lifecycleState: "enabled",
  });
  const result = service.execute({
    connectorId: "crm_sync",
    capability: "sync",
    payload: {},
    secretBindings: [{ secretRef: "secret://test", purpose: "api_key" }],
    policyRef: null,
  }, { environment: "dev" });
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService.execute returns failed for unsupported event type", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm_provider",
    capabilities: ["sync"],
    supportedEvents: ["crm.contact.updated"],
    lifecycleState: "enabled",
  });
  const result = service.execute({
    connectorId: "crm_sync",
    capability: "sync",
    payload: {},
    secretBindings: [{ secretRef: "secret://test", purpose: "api_key" }],
    policyRef: "policy://test",
  }, { environment: "dev", eventType: "crm.contact.deleted" });
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService.execute succeeds for valid request with healthy connector", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm_provider",
    capabilities: ["sync"],
    supportedEvents: ["crm.contact.updated"],
    lifecycleState: "enabled",
  });
  service.recordHealth({
    connectorId: "crm_sync",
    status: "healthy",
    latencyMs: 50,
    checkedAt: "2026-04-20T00:00:00.000Z",
  });
  const result = service.execute({
    connectorId: "crm_sync",
    capability: "sync",
    payload: {},
    secretBindings: [{ secretRef: "secret://test", purpose: "api_key" }],
    policyRef: "policy://test",
  }, { environment: "dev", eventType: "crm.contact.updated" });
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ConnectorFrameworkService.execute returns deferred for degraded connector", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm_provider",
    capabilities: ["sync"],
    supportedEvents: ["crm.contact.updated"],
    lifecycleState: "verified",
  });
  service.recordHealth({
    connectorId: "crm_sync",
    status: "degraded",
    latencyMs: 400,
    checkedAt: "2026-04-20T00:00:00.000Z",
  });
  const result = service.execute({
    connectorId: "crm_sync",
    capability: "sync",
    payload: {},
    secretBindings: [{ secretRef: "secret://test", purpose: "api_key" }],
    policyRef: "policy://test",
  }, { environment: "prod", eventType: "crm.contact.updated" });
  assert.equal(result.success, true);
  assert.equal(result.status, "deferred");
});

test("ConnectorFrameworkService.listEnabled returns only enabled connectors", () => {
  const service = new ConnectorFrameworkService();
  service.register({ connectorId: "conn-1", provider: "p1", lifecycleState: "enabled" });
  service.register({ connectorId: "conn-2", provider: "p2", lifecycleState: "verified" });
  service.register({ connectorId: "conn-3", provider: "p3", lifecycleState: "disabled" });
  const enabled = service.listEnabled();
  assert.equal(enabled.length, 2);
  assert.ok(enabled.some((c) => c.connectorId === "conn-1"));
  assert.ok(enabled.some((c) => c.connectorId === "conn-2"));
  assert.ok(!enabled.some((c) => c.connectorId === "conn-3"));
});

test("ConnectorFrameworkService.listBindings filters by connectorId", () => {
  const service = new ConnectorFrameworkService();
  service.register({ connectorId: "conn-1", provider: "p1", lifecycleState: "enabled" });
  service.bind("conn-1", "tenant_1", "dev");
  service.bind("conn-1", "tenant_2", "dev");
  const bindings = service.listBindings({ connectorId: "conn-1" });
  assert.equal(bindings.length, 2);
});

test("ConnectorFrameworkService.listBindings filters by tenantId", () => {
  const service = new ConnectorFrameworkService();
  service.register({ connectorId: "conn-1", provider: "p1", lifecycleState: "enabled" });
  service.bind("conn-1", "tenant_1", "dev");
  service.bind("conn-1", "tenant_2", "dev");
  const bindings = service.listBindings({ tenantId: "tenant_1" });
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].tenantId, "tenant_1");
});

test("ConnectorFrameworkService.listBindings filters by environment", () => {
  const service = new ConnectorFrameworkService();
  service.register({ connectorId: "conn-1", provider: "p1", lifecycleState: "enabled" });
  service.bind("conn-1", "tenant_1", "dev");
  service.bind("conn-1", "tenant_2", "prod");
  const bindings = service.listBindings({ environment: "prod" });
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].environment, "prod");
});

test("ConnectorFrameworkService.getManifest returns null for unknown connector", () => {
  const service = new ConnectorFrameworkService();
  const manifest = service.getManifest("unknown_connector");
  assert.equal(manifest, null);
});