import { strict as assert } from "node:assert";
import { test } from "node:test";

import { createNoOpIncidentFacadeService } from "../../../../../src/platform/five-plane-interface/api/facade-interfaces.js";

test("NoOpIncidentFacadeService read paths return empty incident state", () => {
  const service = createNoOpIncidentFacadeService();

  assert.deepEqual(service.listIncidents(10, "tenant_123"), []);
  assert.deepEqual(service.listIncidentsPaginated(10, "tenant_123"), { incidents: [], nextToken: null });
  assert.equal(service.getIncident("incident_abc", "tenant_123"), null);
});

test("NoOpIncidentFacadeService mutation paths throw the not-configured error", () => {
  const service = createNoOpIncidentFacadeService();

  assert.throws(
    () => service.openIncident({ tenantId: "tenant_123", severity: "high", title: "Test incident" }),
    { message: "incident_facade.not_configured" },
  );
  assert.throws(
    () => service.acknowledge("incident_abc", "owner_user"),
    { message: "incident_facade.not_configured" },
  );
  assert.throws(
    () => service.startMitigation("incident_abc"),
    { message: "incident_facade.not_configured" },
  );
  assert.throws(
    () => service.resolve("incident_abc"),
    { message: "incident_facade.not_configured" },
  );
});
