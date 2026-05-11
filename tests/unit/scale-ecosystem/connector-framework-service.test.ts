import assert from "node:assert/strict";
import test from "node:test";

import { ConnectorFrameworkService } from "../../../src/scale-ecosystem/integration/connector-framework-service.js";

function manifest(lifecycleState: "registered" | "configured" | "verified" | "enabled" | "disabled" | "revoked") {
  return {
    connectorId: "crm_sync",
    provider: "crm",
    capabilities: ["sync"],
    authMode: "oauth2",
    rateLimits: { perMinute: 60 },
    supportedEvents: ["crm.contact.updated"],
    lifecycleState,
  };
}

test("ConnectorFrameworkService enforces verification and health on production execution", () => {
  const service = new ConnectorFrameworkService();
  service.register(manifest("verified"));
  const binding = service.bind("crm_sync", "tenant_1", "prod", "2026-04-20T00:00:00.000Z");
  assert.equal(binding.environment, "prod");

  service.recordHealth({
    connectorId: "crm_sync",
    status: "healthy",
    latencyMs: 100,
    checkedAt: "2026-04-20T00:01:00.000Z",
  });
  const result = service.execute({
    connectorId: "crm_sync",
    capability: "sync",
    payload: {},
    policyRef: "policy.connector.crm_sync",
    secretBindings: [{ secretRef: "secret://crm_sync/token", purpose: "api_token" }],
  }, {
    environment: "prod",
    eventType: "crm.contact.updated",
    executedAt: "2026-04-20T00:02:00.000Z",
  });
  assert.equal(result.status, "succeeded");
});

test("ConnectorFrameworkService forbids unverified prod events and failed health cannot return success", () => {
  const service = new ConnectorFrameworkService();
  service.register(manifest("configured"));
  assert.throws(() => {
    service.bind("crm_sync", "tenant_1", "prod");
  }, /connector_framework\.prod_requires_verified/);

  service.register({
    ...manifest("enabled"),
    connectorId: "erp_sync",
    supportedEvents: ["erp.invoice.created"],
  });
  service.recordHealth({
    connectorId: "erp_sync",
    status: "failed",
    latencyMs: 1000,
    checkedAt: "2026-04-20T00:01:00.000Z",
  });
  const result = service.execute({
    connectorId: "erp_sync",
    capability: "sync",
    payload: {},
    policyRef: "policy.connector.erp_sync",
    secretBindings: [{ secretRef: "secret://erp_sync/token", purpose: "api_token" }],
  }, {
    environment: "prod",
    eventType: "erp.invoice.created",
  });
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService evicts bindings older than maxBindingAgeMs", () => {
  // Use a very short maxBindingAgeMs (1ms) to trigger eviction on next bind
  const service = new ConnectorFrameworkService(null, 1);
  service.register(manifest("enabled"));

  // Bind with an old timestamp
  service.bind("crm_sync", "tenant_old", "dev", "2020-01-01T00:00:00.000Z");

  // Bind with a fresh timestamp — should evict the old one
  service.bind("crm_sync", "tenant_new", "dev", new Date().toISOString());

  const bindings = service.listBindings({ connectorId: "crm_sync" });
  assert.equal(bindings.length, 1, "Old binding should be evicted");
  assert.equal(bindings[0]!.tenantId, "tenant_new");
});

test("ConnectorFrameworkService retains at most healthRetentionCount health reports per connector", () => {
  // Use retention count of 3
  const service = new ConnectorFrameworkService(null, 30 * 24 * 60 * 60 * 1000, 3);
  service.register(manifest("enabled"));

  for (let i = 0; i < 5; i++) {
    service.recordHealth({
      connectorId: "crm_sync",
      status: "healthy",
      latencyMs: 100 + i,
      checkedAt: new Date(Date.now() + i * 1000).toISOString(),
    });
  }

  const reports = service["health"].get("crm_sync") ?? [];
  assert.equal(reports.length, 3, "Health reports should be capped at retention count");
});
