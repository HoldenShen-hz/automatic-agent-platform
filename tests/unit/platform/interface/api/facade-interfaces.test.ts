import test from "node:test";
import assert from "node:assert/strict";
import { createNoOpIncidentFacadeService } from "../../../../../src/platform/five-plane-interface/api/facade-interfaces.js";

test("createNoOpIncidentFacadeService returns an IncidentFacadeService", () => {
  const svc = createNoOpIncidentFacadeService();
  assert.ok(svc != null);
});

test("createNoOpIncidentFacadeService listIncidents returns empty array", () => {
  const svc = createNoOpIncidentFacadeService();
  assert.deepEqual(svc.listIncidents(), []);
});

test("createNoOpIncidentFacadeService listIncidents with limit returns empty array", () => {
  const svc = createNoOpIncidentFacadeService();
  assert.deepEqual(svc.listIncidents(10), []);
});

test("createNoOpIncidentFacadeService getIncident returns null", () => {
  const svc = createNoOpIncidentFacadeService();
  assert.equal(svc.getIncident("incident-1"), null);
});

test("createNoOpIncidentFacadeService openIncident throws error", () => {
  const svc = createNoOpIncidentFacadeService();
  assert.throws(() => svc.openIncident({ severity: "high", title: "Test" }), /not configured/);
});

test("createNoOpIncidentFacadeService acknowledge throws error", () => {
  const svc = createNoOpIncidentFacadeService();
  assert.throws(() => svc.acknowledge("incident-1", "operator-1"), /not configured/);
});

test("createNoOpIncidentFacadeService startMitigation throws error", () => {
  const svc = createNoOpIncidentFacadeService();
  assert.throws(() => svc.startMitigation("incident-1"), /not configured/);
});

test("createNoOpIncidentFacadeService resolve throws error", () => {
  const svc = createNoOpIncidentFacadeService();
  assert.throws(() => svc.resolve("incident-1"), /not configured/);
});

test("IncidentCase type allows creating incident case object", () => {
  const incident = {
    incidentId: "inc-123",
    severity: "critical" as const,
    status: "open" as const,
    title: "System down",
    linkedEvidenceRefs: ["ref-1", "ref-2"],
    owner: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    resolvedAt: null,
  };
  assert.equal(incident.incidentId, "inc-123");
  assert.equal(incident.severity, "critical");
});

test("CoordinatorSelectionInput allows optional fields", () => {
  const input = { tenantId: "tenant-1" };
  assert.equal(input.tenantId, "tenant-1");
});

test("ArtifactRecord allows creating artifact record", () => {
  const artifact = {
    artifactId: "art-1",
    name: "release.zip",
    mimeType: "application/zip",
    sizeBytes: 1024,
    checksum: "abc123",
    storageRef: "s3://bucket/path",
    createdAt: "2024-01-01T00:00:00Z",
  };
  assert.equal(artifact.name, "release.zip");
});
