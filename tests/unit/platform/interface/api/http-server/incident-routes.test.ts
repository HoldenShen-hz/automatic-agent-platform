import assert from "node:assert/strict";
import test from "node:test";

import { IncidentCaseService } from "../../../../../../src/platform/state-evidence/incident/index.js";

test("IncidentCaseService opens incident", () => {
  const service = new IncidentCaseService();

  const incident = service.openIncident({
    severity: "high",
    title: "Test incident",
    linkedEvidenceRefs: ["ref-1"],
  });

  assert.ok(incident.incidentId);
  assert.equal(incident.severity, "high");
  assert.equal(incident.status, "open");
  assert.equal(incident.title, "Test incident");
  assert.equal(incident.linkedEvidenceRefs.length, 1);
});

test("IncidentCaseService acknowledges incident", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({ severity: "high", title: "Test" });

  const acknowledged = service.acknowledge(incident.incidentId, "operator-1");

  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(acknowledged.owner, "operator-1");
});

test("IncidentCaseService resolves incident", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({ severity: "high", title: "Test" });
  service.acknowledge(incident.incidentId, "operator-1");

  const resolved = service.resolve(incident.incidentId);

  assert.equal(resolved.status, "resolved");
  assert.ok(resolved.resolvedAt);
});

test("IncidentCaseService startMitigation requires acknowledge first", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({ severity: "high", title: "Test" });

  assert.throws(() => {
    service.startMitigation(incident.incidentId);
  }, /must be acknowledged/);
});

test("IncidentCaseService getIncident returns null for unknown", () => {
  const service = new IncidentCaseService();

  const result = service.getIncident("unknown");

  assert.equal(result, null);
});
