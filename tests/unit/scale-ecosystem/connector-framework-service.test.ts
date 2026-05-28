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

test("ConnectorFrameworkService enforces verification and health on production execution [connector-framework-service]", async () => {
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
  const result = await service.execute({
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

test("ConnectorFrameworkService forbids unverified prod events and failed health cannot return success [connector-framework-service]", async () => {
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
  const result = await service.execute({
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

test("ConnectorFrameworkService evicts bindings older than maxBindingAgeMs [connector-framework-service]", () => {
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

test("ConnectorFrameworkService retains at most healthRetentionCount health reports per connector [connector-framework-service]", () => {
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

test("ConnectorFrameworkService evicts LRU connector's bindings when maxBindings is exceeded [connector-framework-service]", () => {
  // maxBindings=4. We add 4 bindings (reaching capacity), then add 1 more which triggers eviction.
  // Eviction removes 1 binding from the LRU head (crm_sync with 3 bindings, so it loses 1, not all).
  // crm_sync: 3 → 2, erp_sync: 1 → 1, jira_sync: 1 → 1. Total: 4.
  const service = new ConnectorFrameworkService(null, 30 * 24 * 60 * 60 * 1000, 100, 4);
  service.register(manifest("enabled"));
  service.register({ ...manifest("enabled"), connectorId: "erp_sync" });
  service.register({ ...manifest("enabled"), connectorId: "jira_sync" });

  service.bind("crm_sync", "tenant_A1", "dev");
  service.bind("crm_sync", "tenant_A2", "dev");
  service.bind("crm_sync", "tenant_A3", "dev");
  service.bind("erp_sync", "tenant_B1", "dev");
  // At capacity: crm_sync(3) + erp_sync(1) = 4, LRU: [crm_sync, erp_sync]

  // Adding jira_sync's 1st binding: total=5, excess=1, eviction targets LRU head (crm_sync)
  service.bind("jira_sync", "tenant_C1", "dev");

  const allBindings = service.listBindings();
  const connectorIds = new Set(allBindings.map((b) => b.connectorId));

  // All three connectors remain (partial eviction from crm_sync, not full)
  assert.ok(connectorIds.has("crm_sync"), "crm_sync should remain (partial eviction only)");
  assert.ok(connectorIds.has("erp_sync"), "erp_sync should remain");
  assert.ok(connectorIds.has("jira_sync"), "jira_sync should remain");
  assert.equal(allBindings.length, 4, "Total bindings should be 4 after partial eviction");
  assert.equal(allBindings.filter((b) => b.connectorId === "crm_sync").length, 2, "crm_sync should have 2 bindings after eviction");
});

test("ConnectorFrameworkService binding lookup refreshes LRU order before eviction [connector-framework-service]", () => {
  const service = new ConnectorFrameworkService({
    maxBindings: 2,
    maxConnectors: 3,
  });
  service.register(manifest("enabled"));
  service.register({ ...manifest("enabled"), connectorId: "erp_sync" });
  service.register({ ...manifest("enabled"), connectorId: "jira_sync" });

  service.bind("crm_sync", "tenant_A1", "dev");
  service.bind("erp_sync", "tenant_B1", "dev");
  service.listBindings({ connectorId: "crm_sync" });
  service.bind("jira_sync", "tenant_C1", "dev");

  const allBindings = service.listBindings();
  assert.equal(allBindings.some((binding) => binding.connectorId === "crm_sync"), true);
  assert.equal(allBindings.some((binding) => binding.connectorId === "erp_sync"), false);
  assert.equal(allBindings.some((binding) => binding.connectorId === "jira_sync"), true);
});

test("ConnectorFrameworkService evicts LRU health entry when maxHealthConnectors is exceeded [connector-framework-service]", () => {
  // Use maxHealthConnectors = 3 to force eviction after 3 connectors report health
  const service = new ConnectorFrameworkService(null, 30 * 24 * 60 * 60 * 1000, 100, 10_000, 3);
  service.register(manifest("enabled"));
  service.register({ ...manifest("enabled"), connectorId: "erp_sync" });
  service.register({ ...manifest("enabled"), connectorId: "jira_sync" });
  service.register({ ...manifest("enabled"), connectorId: "slack_sync" });

  service.recordHealth({ connectorId: "crm_sync", status: "healthy", latencyMs: 100, checkedAt: new Date().toISOString() });
  // LRU: crm_sync

  service.recordHealth({ connectorId: "erp_sync", status: "healthy", latencyMs: 100, checkedAt: new Date().toISOString() });
  // LRU: erp_sync, crm_sync

  service.recordHealth({ connectorId: "jira_sync", status: "healthy", latencyMs: 100, checkedAt: new Date().toISOString() });
  // LRU: jira_sync, erp_sync, crm_sync (all 3 slots used)

  service.recordHealth({ connectorId: "slack_sync", status: "healthy", latencyMs: 100, checkedAt: new Date().toISOString() });
  // LRU: slack_sync, jira_sync, erp_sync, crm_sync — crm_sync should be evicted

  assert.ok(service["health"].has("slack_sync"), "slack_sync should have health entry");
  assert.ok(service["health"].has("jira_sync"), "jira_sync should have health entry");
  assert.ok(service["health"].has("erp_sync"), "erp_sync should have health entry");
  assert.ok(!service["health"].has("crm_sync"), "LRU entry (crm_sync) should be evicted");
  assert.equal(service["health"].size, 3, "Health map should have exactly 3 entries");
});

test("ConnectorFrameworkService rejects registrations beyond maxConnectors [connector-framework-service]", () => {
  const service = new ConnectorFrameworkService({ maxConnectors: 2 });
  service.register(manifest("enabled"));
  service.register({ ...manifest("enabled"), connectorId: "erp_sync" });

  assert.throws(
    () => service.register({ ...manifest("enabled"), connectorId: "jira_sync" }),
    /connector_framework\.connector_capacity_exceeded/,
  );
});
