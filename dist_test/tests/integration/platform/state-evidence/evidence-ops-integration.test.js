import assert from "node:assert/strict";
import test from "node:test";
import { EventProjectionService } from "../../../../src/platform/state-evidence/projections/index.js";
import { AuditTrailService } from "../../../../src/platform/state-evidence/audit/index.js";
import { IncidentCaseService } from "../../../../src/platform/state-evidence/incident/index.js";
import { DeadLetterQueueService } from "../../../../src/platform/state-evidence/dlq/index.js";
test("integration: projection, audit, incident, and DLQ services share a consistent evidence chain", () => {
    const projections = new EventProjectionService();
    const audits = new AuditTrailService();
    const incidents = new IncidentCaseService();
    const dlq = new DeadLetterQueueService();
    const projection = projections.applyEvent({
        eventId: "evt_1",
        eventType: "workflow:step_failed",
        taskId: "task_42",
        payloadJson: JSON.stringify({ reasonCode: "tool.execution_failed" }),
        createdAt: "2026-04-20T00:00:00.000Z",
    });
    const deadLetter = dlq.enqueue({
        sourceEventId: "evt_1",
        consumerId: "channel-gateway",
        errorCode: "delivery.timeout",
        payloadJson: JSON.stringify(projection.state),
    });
    const audit = audits.record({
        actorType: "recovery",
        actorId: "dlq-replayer",
        tenantId: "tenant_a",
        taskId: "task_42",
        executionId: null,
        action: "dlq.enqueued",
        resourceRef: `dlq:${deadLetter.deadLetterId}`,
        decisionRef: null,
        versionRef: null,
        metadata: { sourceEventId: deadLetter.sourceEventId },
    });
    const incident = incidents.openIncident({
        severity: "high",
        title: "workflow failure propagated to DLQ",
        linkedEvidenceRefs: [projection.projectionId, audit.auditId, deadLetter.deadLetterId],
    });
    assert.equal(projection.projectionName, "workflow_summary");
    assert.equal(audits.exportForTask("task_42").length, 1);
    assert.equal(incident.linkedEvidenceRefs.length, 3);
});
//# sourceMappingURL=evidence-ops-integration.test.js.map