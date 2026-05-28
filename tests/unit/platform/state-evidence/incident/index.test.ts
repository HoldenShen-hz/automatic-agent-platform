import assert from "node:assert/strict";
import test from "node:test";

import { IncidentCaseService } from "../../../../../src/platform/five-plane-state-evidence/incident/index.js";

test("IncidentCaseService enforces acknowledge before mitigation and reviewed before resolve", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    severity: "high",
    title: "event backlog exceeded threshold",
    linkedEvidenceRefs: ["audit:1"],
  });

  assert.throws(() => service.startMitigation(incident.incidentId));
  const acknowledged = service.acknowledge(incident.incidentId, "oncall@example.com");
  const mitigating = service.startMitigation(incident.incidentId);
  const reviewed = service.review(incident.incidentId);
  const resolved = service.resolve(incident.incidentId);

  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(mitigating.status, "mitigating");
  assert.equal(reviewed.status, "reviewed");
  assert.equal(resolved.status, "resolved");
});
