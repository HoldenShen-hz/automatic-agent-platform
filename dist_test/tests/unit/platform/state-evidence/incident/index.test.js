import assert from "node:assert/strict";
import test from "node:test";
import { IncidentCaseService } from "../../../../../src/platform/state-evidence/incident/index.js";
test("IncidentCaseService enforces acknowledge before mitigation and resolves incidents", () => {
    const service = new IncidentCaseService();
    const incident = service.openIncident({
        severity: "high",
        title: "event backlog exceeded threshold",
        linkedEvidenceRefs: ["audit:1"],
    });
    assert.throws(() => service.startMitigation(incident.incidentId));
    const acknowledged = service.acknowledge(incident.incidentId, "oncall@example.com");
    const mitigating = service.startMitigation(incident.incidentId);
    const resolved = service.resolve(incident.incidentId);
    assert.equal(acknowledged.status, "acknowledged");
    assert.equal(mitigating.status, "mitigating");
    assert.equal(resolved.status, "resolved");
});
//# sourceMappingURL=index.test.js.map