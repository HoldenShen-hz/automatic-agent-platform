import assert from "node:assert/strict";
import test from "node:test";

import { ConnectorFrameworkService } from "../../../src/scale-ecosystem/integration/connector-framework-service.js";

test("integration: verified connector runs prod callback path while degraded connectors defer instead of succeeding silently", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm",
    capabilities: ["sync"],
    authMode: "oauth2",
    rateLimits: { perMinute: 60 },
    supportedEvents: ["crm.contact.updated"],
    lifecycleState: "verified",
  });
  service.bind("crm_sync", "tenant_1", "prod", "2026-04-20T00:00:00.000Z");
  service.recordHealth({
    connectorId: "crm_sync",
    status: "degraded",
    latencyMs: 400,
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
  assert.equal(result.status, "deferred");
});
