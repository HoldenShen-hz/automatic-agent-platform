import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  createNoOpIncidentFacadeService,
} from "../../../../../src/platform/five-plane-interface/api/facade-interfaces.js";

test("NoOpIncidentFacadeService.listIncidents returns empty array", () => {
  const service = createNoOpIncidentFacadeService();
  const result = service.listIncidents("tenant_123", 10);
  assert.deepEqual(result, []);
});

test("NoOpIncidentFacadeService.listIncidents works without tenantId", () => {
  const service = createNoOpIncidentFacadeService();
  const result = service.listIncidents(undefined, 50);
  assert.deepEqual(result, []);
});

test("NoOpIncidentFacadeService.getIncident returns null", () => {
  const service = createNoOpIncidentFacadeService();
  const result = service.getIncident("tenant_123", "incident_abc");
  assert.equal(result, null);
});

test("NoOpIncidentFacadeService.getIncident works without tenantId", () => {
  const service = createNoOpIncidentFacadeService();
  const result = service.getIncident(undefined, "incident_xyz");
  assert.equal(result, null);
});

test("NoOpIncidentFacadeService.openIncident throws Error", () => {
  const service = createNoOpIncidentFacadeService();
  assert.throws(
    () => service.openIncident({ tenantId: "tenant_123", severity: "high", title: "Test incident" }),
    { message: "Incident service not configured" },
  );
});

test("NoOpIncidentFacadeService.openIncident throws even with minimal input", () => {
  const service = createNoOpIncidentFacadeService();
  assert.throws(
    () => service.openIncident({ tenantId: null, severity: "low", title: "Minimal incident" }),
    { message: "Incident service not configured" },
  );
});

test("NoOpIncidentFacadeService.acknowledge throws Error with tenantId", () => {
  const service = createNoOpIncidentFacadeService();
  assert.throws(
    () => service.acknowledge("tenant_123", "incident_abc", "owner_user"),
    { message: "Incident service not configured" },
  );
});

test("NoOpIncidentFacadeService.acknowledge throws even without tenantId", () => {
  const service = createNoOpIncidentFacadeService();
  assert.throws(
    () => service.acknowledge(undefined, "incident_xyz", "owner_user"),
    { message: "Incident service not configured" },
  );
});

test("NoOpIncidentFacadeService.startMitigation throws Error with tenantId", () => {
  const service = createNoOpIncidentFacadeService();
  assert.throws(
    () => service.startMitigation("tenant_123", "incident_abc"),
    { message: "Incident service not configured" },
  );
});

test("NoOpIncidentFacadeService.startMitigation throws even without tenantId", () => {
  const service = createNoOpIncidentFacadeService();
  assert.throws(
    () => service.startMitigation(undefined, "incident_xyz"),
    { message: "Incident service not configured" },
  );
});

test("NoOpIncidentFacadeService.resolve throws Error with tenantId", () => {
  const service = createNoOpIncidentFacadeService();
  assert.throws(
    () => service.resolve("tenant_123", "incident_abc"),
    { message: "Incident service not configured" },
  );
});

test("NoOpIncidentFacadeService.resolve throws even without tenantId", () => {
  const service = createNoOpIncidentFacadeService();
  assert.throws(
    () => service.resolve(undefined, "incident_xyz"),
    { message: "Incident service not configured" },
  );
});

test("createNoOpIncidentFacadeService returns instance implementing IncidentFacadeService", () => {
  const service = createNoOpIncidentFacadeService();
  // Verify all required methods exist
  assert.equal(typeof service.listIncidents, "function");
  assert.equal(typeof service.getIncident, "function");
  assert.equal(typeof service.openIncident, "function");
  assert.equal(typeof service.acknowledge, "function");
  assert.equal(typeof service.startMitigation, "function");
  assert.equal(typeof service.resolve, "function");
});
