import assert from "node:assert/strict";
import test from "node:test";
import { ConnectorFrameworkService } from "../../../src/scale-ecosystem/integration/connector-framework-service.js";
import { ConnectorManifestSchema } from "../../../src/scale-ecosystem/integration/connector-registry/index.js";

test("integration: ConnectorFrameworkService end-to-end registration and execution flow", () => {
  const service = new ConnectorFrameworkService();

  // Register CRM connector
  service.register(ConnectorManifestSchema.parse({
    connectorId: "crm_connector",
    provider: "crm_provider",
    capabilities: ["sync", "read", "write"],
    supportedEvents: ["crm.contact.created", "crm.contact.updated", "crm.contact.deleted"],
    lifecycleState: "verified",
  }));

  // Bind to multiple tenants
  const binding1 = service.bind("crm_connector", "tenant-A", "prod", "2026-04-20T00:00:00.000Z");
  const binding2 = service.bind("crm_connector", "tenant-B", "prod", "2026-04-20T00:00:00.000Z");

  // Record health
  service.recordHealth({
    connectorId: "crm_connector",
    status: "healthy",
    latencyMs: 45,
    checkedAt: "2026-04-20T00:01:00.000Z",
  });

  // Execute for tenant A
  const result1 = service.execute({
    connectorId: "crm_connector",
    capability: "sync",
    payload: { contactId: "contact-123" },
    secretBindings: [{ secretRef: "secret://crm/tenant-a", purpose: "api_token" }],
    policyRef: "policy://connectors/crm",
  }, { environment: "prod", eventType: "crm.contact.updated", executedAt: "2026-04-20T00:02:00.000Z" });

  assert.equal(result1.success, true);
  assert.equal(result1.status, "succeeded");

  // Verify bindings
  const allBindings = service.listBindings({ connectorId: "crm_connector" });
  assert.equal(allBindings.length, 2);

  const tenantABindings = service.listBindings({ tenantId: "tenant-A", environment: "prod" });
  assert.equal(tenantABindings.length, 1);
  assert.equal(tenantABindings[0].tenantId, "tenant-A");
});

test("integration: ConnectorFrameworkService handles degraded connector gracefully", () => {
  const service = new ConnectorFrameworkService();

  service.register(ConnectorManifestSchema.parse({
    connectorId: "data_pipeline",
    provider: "pipeline_provider",
    capabilities: ["transform", "load"],
    supportedEvents: ["pipeline.run", "pipeline.complete"],
    lifecycleState: "verified",
  }));

  service.bind("data_pipeline", "tenant-1", "prod", "2026-04-20T00:00:00.000Z");

  // Record degraded health
  service.recordHealth({
    connectorId: "data_pipeline",
    status: "degraded",
    latencyMs: 500,
    checkedAt: "2026-04-20T00:01:00.000Z",
  });

  const result = service.execute({
    connectorId: "data_pipeline",
    capability: "transform",
    payload: { data: "sample" },
    secretBindings: [{ secretRef: "secret://pipeline", purpose: "api_key" }],
    policyRef: "policy://pipeline",
  }, { environment: "prod", eventType: "pipeline.run" });

  // Degraded connector returns deferred status but still success
  assert.equal(result.success, true);
  assert.equal(result.status, "deferred");
});

test("integration: ConnectorFrameworkService blocks execution for failed connector", () => {
  const service = new ConnectorFrameworkService();

  service.register(ConnectorManifestSchema.parse({
    connectorId: "payment_gateway",
    provider: "payment_provider",
    capabilities: ["charge", "refund"],
    supportedEvents: ["payment.processed"],
    lifecycleState: "enabled",
  }));

  service.bind("payment_gateway", "merchant-1", "prod", "2026-04-20T00:00:00.000Z");

  // Record failed health
  service.recordHealth({
    connectorId: "payment_gateway",
    status: "failed",
    latencyMs: 0,
    checkedAt: "2026-04-20T00:01:00.000Z",
  });

  const result = service.execute({
    connectorId: "payment_gateway",
    capability: "charge",
    payload: { amount: 100, currency: "USD" },
    secretBindings: [{ secretRef: "secret://payment", purpose: "api_key" }],
    policyRef: "policy://payment",
  }, { environment: "prod", eventType: "payment.processed" });

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("integration: ConnectorFrameworkService enforces prod verified requirement", () => {
  const service = new ConnectorFrameworkService();

  service.register(ConnectorManifestSchema.parse({
    connectorId: "analytics_connector",
    provider: "analytics_provider",
    capabilities: ["collect"],
    lifecycleState: "registered", // Not verified
  }));

  // Attempt to bind in prod should fail
  assert.throws(() => {
    service.bind("analytics_connector", "tenant-1", "prod", "2026-04-20T00:00:00.000Z");
  }, (err) => err.message.includes("prod_requires_verified"));

  // Dev/staging should work
  const devBinding = service.bind("analytics_connector", "tenant-1", "dev", "2026-04-20T00:00:00.000Z");
  assert.equal(devBinding.environment, "dev");
});

test("integration: ConnectorFrameworkService filters bindings by multiple criteria", () => {
  const service = new ConnectorFrameworkService();

  service.register(ConnectorManifestSchema.parse({
    connectorId: "multi_tenant_connector",
    provider: "shared_provider",
    capabilities: ["process"],
    lifecycleState: "enabled",
  }));

  service.bind("multi_tenant_connector", "tenant-1", "dev", "2026-04-20T00:00:00.000Z");
  service.bind("multi_tenant_connector", "tenant-1", "prod", "2026-04-20T00:00:00.000Z");
  service.bind("multi_tenant_connector", "tenant-2", "dev", "2026-04-20T00:00:00.000Z");
  service.bind("multi_tenant_connector", "tenant-2", "prod", "2026-04-20T00:00:00.000Z");

  // Filter by tenant
  const tenant1Bindings = service.listBindings({ tenantId: "tenant-1" });
  assert.equal(tenant1Bindings.length, 2);

  // Filter by environment
  const prodBindings = service.listBindings({ environment: "prod" });
  assert.equal(prodBindings.length, 2);

  // Filter by tenant and environment
  const tenant1ProdBindings = service.listBindings({ tenantId: "tenant-1", environment: "prod" });
  assert.equal(tenant1ProdBindings.length, 1);
  assert.equal(tenant1ProdBindings[0].tenantId, "tenant-1");
  assert.equal(tenant1ProdBindings[0].environment, "prod");
});

test("integration: ConnectorFrameworkService lists only enabled connectors", () => {
  const service = new ConnectorFrameworkService();

  service.register(ConnectorManifestSchema.parse({ connectorId: "enabled-1", provider: "p1", lifecycleState: "enabled" }));
  service.register(ConnectorManifestSchema.parse({ connectorId: "verified-1", provider: "p1", lifecycleState: "verified" }));
  service.register(ConnectorManifestSchema.parse({ connectorId: "disabled-1", provider: "p1", lifecycleState: "disabled" }));
  service.register(ConnectorManifestSchema.parse({ connectorId: "registered-1", provider: "p1", lifecycleState: "registered" }));
  service.register(ConnectorManifestSchema.parse({ connectorId: "revoked-1", provider: "p1", lifecycleState: "revoked" }));

  const enabled = service.listEnabled();

  // Only enabled and verified connectors are considered enabled by listEnabledConnectors
  assert.equal(enabled.length, 2);
  const enabledIds = enabled.map((c) => c.connectorId);
  assert.ok(enabledIds.includes("enabled-1"));
  assert.ok(enabledIds.includes("verified-1"));
  assert.ok(!enabledIds.includes("disabled-1"));
  assert.ok(!enabledIds.includes("registered-1"));
  assert.ok(!enabledIds.includes("revoked-1"));
});