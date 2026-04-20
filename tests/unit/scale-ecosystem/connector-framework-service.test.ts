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
  }, {
    environment: "prod",
    eventType: "erp.invoice.created",
  });
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});
