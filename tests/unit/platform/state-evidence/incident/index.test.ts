import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentCaseService,
  type IncidentCase,
  type IncidentSeverity,
  type IncidentStatus,
} from "../../../../../src/platform/five-plane-state-evidence/incident/index.js";

test("IncidentCaseService openIncident creates incident with correct fields", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant_1",
    severity: "high",
    title: "Test incident",
    linkedEvidenceRefs: ["evidence_1"],
  });

  assert.equal(incident.severity, "high");
  assert.equal(incident.status, "open");
  assert.equal(incident.title, "Test incident");
  assert.equal(incident.tenantId, "tenant_1");
  assert.deepEqual(incident.linkedEvidenceRefs, ["evidence_1"]);
  assert.ok(incident.incidentId.startsWith("incident_"));
  assert.ok(incident.createdAt.length > 0);
  assert.ok(incident.updatedAt.length > 0);
  assert.equal(incident.resolvedAt, null);
  assert.equal(incident.owner, null);
});

test("IncidentCaseService openIncident defaults linkedEvidenceRefs to empty array", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: null,
    severity: "low",
    title: "No evidence",
  });

  assert.deepEqual(incident.linkedEvidenceRefs, []);
});

test("IncidentCaseService acknowledge transitions incident to acknowledged status", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant_1",
    severity: "medium",
    title: "Test",
  });

  const acknowledged = service.acknowledge("tenant_1", incident.incidentId, "operator_1");

  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(acknowledged.owner, "operator_1");
  assert.ok(acknowledged.updatedAt >= incident.createdAt);
});

test("IncidentCaseService acknowledge throws for unknown incident", () => {
  const service = new IncidentCaseService();
  assert.throws(
    () => service.acknowledge("tenant_1", "unknown_id", "op_1"),
    /was not found/,
  );
});

test("IncidentCaseService startMitigation requires incident to be acknowledged first", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant_1",
    severity: "critical",
    title: "Test",
  });

  assert.throws(
    () => service.startMitigation("tenant_1", incident.incidentId),
    /must be acknowledged before mitigation/,
  );
});

test("IncidentCaseService startMitigation transitions to mitigating status", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant_1",
    severity: "high",
    title: "Test",
  });

  service.acknowledge("tenant_1", incident.incidentId, "op_1");
  const mitigating = service.startMitigation("tenant_1", incident.incidentId);

  assert.equal(mitigating.status, "mitigating");
});

test("IncidentCaseService resolve transitions incident to resolved status", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant_1",
    severity: "low",
    title: "Test",
  });

  service.acknowledge("tenant_1", incident.incidentId, "op_1");
  const resolved = service.resolve("tenant_1", incident.incidentId);

  assert.equal(resolved.status, "resolved");
  assert.ok(resolved.resolvedAt !== null);
  assert.ok(resolved.updatedAt >= incident.createdAt);
});

test("IncidentCaseService getIncident returns null for unknown id", () => {
  const service = new IncidentCaseService();
  assert.equal(service.getIncident("tenant_1", "unknown_id"), null);
});

test("IncidentCaseService getIncident returns null when tenantId mismatch (R14-17)", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant_a",
    severity: "high",
    title: "Test",
  });

  // Different tenant
  assert.equal(service.getIncident("tenant_b", incident.incidentId), null);

  // Same tenant should work
  assert.ok(service.getIncident("tenant_a", incident.incidentId) !== null);
});

test("IncidentCaseService getIncident returns null for null tenant when incident has tenant", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant_1",
    severity: "high",
    title: "Test",
  });

  assert.equal(service.getIncident(null, incident.incidentId), null);
});

test("IncidentCaseService getIncident returns incident when tenantId is null and incident has null tenant", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: null,
    severity: "low",
    title: "System incident",
  });

  assert.ok(service.getIncident(null, incident.incidentId) !== null);
});

test("IncidentCaseService listIncidents returns all incidents for null tenant", () => {
  const service = new IncidentCaseService();
  service.openIncident({ tenantId: null, severity: "low", title: "Incident 1" });
  service.openIncident({ tenantId: null, severity: "high", title: "Incident 2" });
  service.openIncident({ tenantId: "tenant_1", severity: "medium", title: "Incident 3" });

  const list = service.listIncidents(null);
  assert.equal(list.length, 2);
});

test("IncidentCaseService listIncidents filters by tenantId", () => {
  const service = new IncidentCaseService();
  service.openIncident({ tenantId: "tenant_a", severity: "low", title: "A1" });
  service.openIncident({ tenantId: "tenant_a", severity: "high", title: "A2" });
  service.openIncident({ tenantId: "tenant_b", severity: "medium", title: "B1" });

  const listA = service.listIncidents("tenant_a");
  assert.equal(listA.length, 2);

  const listB = service.listIncidents("tenant_b");
  assert.equal(listB.length, 1);
});

test("IncidentCaseService listIncidents respects limit parameter", () => {
  const service = new IncidentCaseService();
  for (let i = 0; i < 10; i++) {
    service.openIncident({ tenantId: null, severity: "low", title: `Incident ${i}` });
  }

  const list = service.listIncidents(null, 5);
  assert.equal(list.length, 5);
});

test("IncidentCaseService listIncidents sorts by createdAt descending", () => {
  const service = new IncidentCaseService();
  const first = service.openIncident({ tenantId: null, severity: "low", title: "First" });
  const second = service.openIncident({ tenantId: null, severity: "low", title: "Second" });
  const third = service.openIncident({ tenantId: null, severity: "low", title: "Third" });

  const list = service.listIncidents(null);

  // Most recent first
  assert.equal(list[0]!.incidentId, third.incidentId);
  assert.equal(list[1]!.incidentId, second.incidentId);
  assert.equal(list[2]!.incidentId, first.incidentId);
});

test("IncidentCaseService listIncidents returns empty array when no matching incidents", () => {
  const service = new IncidentCaseService();
  service.openIncident({ tenantId: "tenant_a", severity: "low", title: "A" });

  const list = service.listIncidents("tenant_b");
  assert.equal(list.length, 0);
});

test("IncidentCaseService all severity levels are accepted", () => {
  const service = new IncidentCaseService();
  const severities: IncidentSeverity[] = ["low", "medium", "high", "critical"];

  for (const severity of severities) {
    const incident = service.openIncident({
      tenantId: null,
      severity,
      title: `Test ${severity}`,
    });
    assert.equal(incident.severity, severity);
  }
});

test("IncidentCaseService acknowledge requires correct tenant scoping", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant_a",
    severity: "high",
    title: "Test",
  });

  // Wrong tenant should throw
  assert.throws(
    () => service.acknowledge("tenant_b", incident.incidentId, "op_1"),
    /was not found/,
  );
});

test("IncidentCaseService startMitigation requires correct tenant scoping", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant_a",
    severity: "high",
    title: "Test",
  });

  service.acknowledge("tenant_a", incident.incidentId, "op_1");

  // Wrong tenant should throw
  assert.throws(
    () => service.startMitigation("tenant_b", incident.incidentId),
    /was not found/,
  );
});

test("IncidentCaseService resolve requires correct tenant scoping", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant_a",
    severity: "high",
    title: "Test",
  });

  service.acknowledge("tenant_a", incident.incidentId, "op_1");

  // Wrong tenant should throw
  assert.throws(
    () => service.resolve("tenant_b", incident.incidentId),
    /was not found/,
  );
});
