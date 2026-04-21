import test from "node:test";
import assert from "node:assert/strict";
import { incidentProjectionHandler, createEmptyIncidentState, createIncidentProjectionHandler, } from "../../../../../../src/platform/state-evidence/events/projections/incident-projection.js";
/**
 * Helper to create a projection input event
 */
function makeEvent(eventId, eventType, taskId = null, payloadJson = "{}", createdAt = "2026-04-19T10:00:00.000Z") {
    return {
        eventId,
        eventType,
        taskId,
        payloadJson,
        createdAt,
    };
}
// =============================================================================
// createEmptyIncidentState Tests
// =============================================================================
test("createEmptyIncidentState returns correct initial state", () => {
    const state = createEmptyIncidentState();
    assert.equal(state.incidentId, null);
    assert.equal(state.severity, null);
    assert.equal(state.status, "detected");
    assert.deepEqual(state.timeline, []);
    assert.deepEqual(state.affectedWorkflows, []);
    assert.deepEqual(state.affectedExecutions, []);
    assert.deepEqual(state.affectedWorkers, []);
    assert.deepEqual(state.affectedRollouts, []);
    assert.deepEqual(state.affectedRepairJobs, []);
    assert.equal(state.eventCount, 0);
    assert.deepEqual(state.processedEventIds, []);
    assert.equal(state.firstEventAt, null);
    assert.equal(state.lastEventAt, null);
    assert.equal(state.detectedAt, null);
    assert.equal(state.resolvedAt, null);
    assert.equal(state.acknowledgedAt, null);
    assert.equal(state.rootCause, null);
    assert.equal(state.description, null);
    assert.equal(state.complianceFramework, null);
});
test("createEmptyIncidentState initializes status as detected", () => {
    const state = createEmptyIncidentState();
    assert.equal(state.status, "detected");
});
// =============================================================================
// incident:created Tests
// =============================================================================
test("incidentProjectionHandler handles incident:created with all fields", () => {
    const payload = {
        incidentId: "inc_001",
        severity: "high",
        description: "Test incident",
        affectedWorkflows: ["wf_1", "wf_2"],
        affectedExecutions: ["exec_1"],
        actorId: "operator_1",
    };
    const event = makeEvent("evt_inc_created", "incident:created", "task_incident_1", JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.incidentId, "inc_001");
    assert.equal(state.severity, "high");
    assert.equal(state.status, "detected");
    assert.equal(state.description, "Test incident");
    assert.deepEqual(state.affectedWorkflows, ["wf_1", "wf_2"]);
    assert.deepEqual(state.affectedExecutions, ["exec_1"]);
    assert.equal(state.detectedAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.firstEventAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.lastEventAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.eventCount, 1);
});
test("incidentProjectionHandler handles incident:created with critical severity", () => {
    const event = makeEvent("evt_critical", "incident:created", null, JSON.stringify({ incidentId: "inc_critical", severity: "critical" }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.severity, "critical");
    assert.equal(state.status, "detected");
});
test("incidentProjectionHandler handles incident:created with medium severity", () => {
    const event = makeEvent("evt_medium", "incident:created", null, JSON.stringify({ incidentId: "inc_medium", severity: "medium" }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.severity, "medium");
});
test("incidentProjectionHandler handles incident:created with low severity", () => {
    const event = makeEvent("evt_low", "incident:created", null, JSON.stringify({ incidentId: "inc_low", severity: "low" }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.severity, "low");
});
test("incidentProjectionHandler handles incident:created without severity", () => {
    const event = makeEvent("evt_no_severity", "incident:created", null, JSON.stringify({ incidentId: "inc_no_severity" }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.severity, null);
    assert.equal(state.status, "detected");
});
// =============================================================================
// incident:acknowledged Tests
// =============================================================================
test("incidentProjectionHandler handles incident:acknowledged", () => {
    const event = makeEvent("evt_ack", "incident:acknowledged", null, JSON.stringify({ incidentId: "inc_001" }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.status, "acknowledged");
    assert.equal(state.acknowledgedAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.eventCount, 1);
});
test("incidentProjectionHandler preserves acknowledgedAt on second acknowledgement", () => {
    const event1 = makeEvent("evt_ack_1", "incident:acknowledged", null, JSON.stringify({}), "2026-04-19T10:00:00.000Z");
    const event2 = makeEvent("evt_ack_2", "incident:acknowledged", null, JSON.stringify({}), "2026-04-19T11:00:00.000Z");
    const state1 = incidentProjectionHandler(null, event1);
    const state2 = incidentProjectionHandler(state1, event2);
    assert.equal(state2.acknowledgedAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state2.status, "acknowledged");
});
// =============================================================================
// incident:investigating Tests
// =============================================================================
test("incidentProjectionHandler handles incident:investigating", () => {
    const event = makeEvent("evt_investigating", "incident:investigating", null, JSON.stringify({ rootCause: "Network timeout detected" }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.status, "investigating");
    assert.equal(state.rootCause, "Network timeout detected");
    assert.equal(state.eventCount, 1);
});
test("incidentProjectionHandler preserves rootCause on subsequent events", () => {
    const event1 = makeEvent("evt_inv_1", "incident:investigating", null, JSON.stringify({ rootCause: "Initial cause" }), "2026-04-19T10:00:00.000Z");
    const event2 = makeEvent("evt_inv_2", "incident:mitigated", null, JSON.stringify({ rootCause: "Different cause" }), "2026-04-19T11:00:00.000Z");
    const state1 = incidentProjectionHandler(null, event1);
    const state2 = incidentProjectionHandler(state1, event2);
    assert.equal(state2.rootCause, "Initial cause");
});
// =============================================================================
// incident:mitigated Tests
// =============================================================================
test("incidentProjectionHandler handles incident:mitigated", () => {
    const event = makeEvent("evt_mitigated", "incident:mitigated", null, JSON.stringify({ rootCause: "Fix applied" }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.status, "mitigated");
    assert.equal(state.rootCause, "Fix applied");
});
test("incidentProjectionHandler handles incident:mitigated without rootCause", () => {
    const event = makeEvent("evt_mitigated_no_cause", "incident:mitigated", null, JSON.stringify({}));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.status, "mitigated");
    assert.equal(state.rootCause, null);
});
// =============================================================================
// incident:resolved Tests
// =============================================================================
test("incidentProjectionHandler handles incident:resolved", () => {
    const event = makeEvent("evt_resolved", "incident:resolved", null, JSON.stringify({ rootCause: "Root cause identified" }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.status, "resolved");
    assert.equal(state.resolvedAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.rootCause, "Root cause identified");
});
test("incidentProjectionHandler handles incident:resolved without rootCause", () => {
    const event = makeEvent("evt_resolved_no_cause", "incident:resolved", null, JSON.stringify({}));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.status, "resolved");
    assert.equal(state.resolvedAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.rootCause, null);
});
// =============================================================================
// incident:cancelled Tests
// =============================================================================
test("incidentProjectionHandler handles incident:cancelled", () => {
    const event = makeEvent("evt_cancelled", "incident:cancelled", null, JSON.stringify({}));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.status, "cancelled");
    assert.equal(state.resolvedAt, "2026-04-19T10:00:00.000Z");
});
// =============================================================================
// compliance:violation_detected Tests
// =============================================================================
test("incidentProjectionHandler handles compliance:violation_detected", () => {
    const payload = {
        violationId: "viol_001",
        severity: "high",
        description: "GDPR violation",
        framework: "GDPR",
        resourceId: "exec_123",
    };
    const event = makeEvent("evt_compliance", "compliance:violation_detected", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.incidentId, "viol_001");
    assert.equal(state.severity, "high");
    assert.equal(state.description, "GDPR violation");
    assert.equal(state.complianceFramework, "GDPR");
    assert.deepEqual(state.affectedExecutions, ["exec_123"]);
    assert.equal(state.detectedAt, "2026-04-19T10:00:00.000Z");
});
test("incidentProjectionHandler handles compliance:violation_detected without framework", () => {
    const event = makeEvent("evt_compliance_no_fw", "compliance:violation_detected", null, JSON.stringify({ violationId: "viol_002" }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.complianceFramework, null);
});
// =============================================================================
// slo:breached Tests
// =============================================================================
test("incidentProjectionHandler handles slo:breached", () => {
    const payload = {
        sloId: "slo_001",
        sloName: "API Latency",
        metricName: "p99_latency",
        currentValue: 500,
        targetValue: 200,
    };
    const event = makeEvent("evt_slo_breach", "slo:breached", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.incidentId, "slo_001");
    assert.equal(state.severity, "high");
    assert.match(state.description, /SLO breach/);
    assert.match(state.description, /API Latency/);
    assert.match(state.description, /p99_latency/);
    assert.match(state.description, /500/);
    assert.match(state.description, /200/);
    assert.equal(state.detectedAt, "2026-04-19T10:00:00.000Z");
});
test("incidentProjectionHandler handles slo:breached with missing fields", () => {
    const event = makeEvent("evt_slo_minimal", "slo:breached", null, JSON.stringify({ sloId: "slo_002" }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.incidentId, "slo_002");
    assert.equal(state.severity, "high");
    assert.match(state.description, /SLO breach/);
    assert.match(state.description, /unknown/);
});
// =============================================================================
// Idempotency and Replay Safety Tests
// =============================================================================
test("incidentProjectionHandler is idempotent - same event applied twice", () => {
    const event = makeEvent("evt_idempotent", "incident:created", null, JSON.stringify({ incidentId: "inc_001", severity: "high" }));
    const state1 = incidentProjectionHandler(null, event);
    const state2 = incidentProjectionHandler(state1, event);
    assert.equal(state2.eventCount, 1);
    assert.deepEqual(state2.processedEventIds, ["evt_idempotent"]);
    assert.equal(state2.incidentId, "inc_001");
    assert.equal(state2.severity, "high");
});
test("incidentProjectionHandler deduplicates event_ids", () => {
    const event = makeEvent("evt_dedup", "incident:acknowledged", null, JSON.stringify({}));
    const state1 = incidentProjectionHandler(null, event);
    const state2 = incidentProjectionHandler(state1, event);
    const state3 = incidentProjectionHandler(state2, event);
    assert.equal(state3.eventCount, 1);
    assert.deepEqual(state3.processedEventIds, ["evt_dedup"]);
});
test("incidentProjectionHandler is replay-safe - events in order", () => {
    const events = [
        makeEvent("evt_1", "incident:created", null, JSON.stringify({ incidentId: "inc_replay", severity: "high" }), "2026-04-19T10:00:00.000Z"),
        makeEvent("evt_2", "incident:acknowledged", null, JSON.stringify({}), "2026-04-19T10:01:00.000Z"),
        makeEvent("evt_3", "incident:investigating", null, JSON.stringify({ rootCause: "Root cause" }), "2026-04-19T10:02:00.000Z"),
        makeEvent("evt_4", "incident:resolved", null, JSON.stringify({}), "2026-04-19T10:03:00.000Z"),
    ];
    let state = null;
    for (const event of events) {
        state = incidentProjectionHandler(state, event);
    }
    const finalState = state;
    assert.equal(finalState.eventCount, 4);
    assert.equal(finalState.status, "resolved");
    assert.equal(finalState.resolvedAt, "2026-04-19T10:03:00.000Z");
    assert.equal(finalState.timeline.length, 4);
    assert.equal(finalState.timeline[0].eventId, "evt_1");
    assert.equal(finalState.timeline[3].eventId, "evt_4");
    assert.equal(finalState.firstEventAt, "2026-04-19T10:00:00.000Z");
    assert.equal(finalState.lastEventAt, "2026-04-19T10:03:00.000Z");
});
// =============================================================================
// Affected Entity Linking Tests
// =============================================================================
test("incidentProjectionHandler links affected workflows", () => {
    const payload = {
        incidentId: "inc_wf",
        affectedWorkflows: ["wf_a", "wf_b", "wf_c"],
        workflowIds: ["wf_d"], // alternative field name - not used when affectedWorkflows is present
    };
    const event = makeEvent("evt_wf_link", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    // Only affectedWorkflows is used (workflowIds is fallback when affectedWorkflows is missing)
    assert.deepEqual(state.affectedWorkflows, ["wf_a", "wf_b", "wf_c"]);
});
test("incidentProjectionHandler uses workflowIds when affectedWorkflows is missing", () => {
    const payload = {
        incidentId: "inc_wf_alt",
        workflowIds: ["wf_alt_1", "wf_alt_2"],
    };
    const event = makeEvent("evt_wf_link_alt", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    assert.deepEqual(state.affectedWorkflows, ["wf_alt_1", "wf_alt_2"]);
});
test("incidentProjectionHandler links affected executions", () => {
    const payload = {
        incidentId: "inc_exec",
        affectedExecutions: ["exec_x", "exec_y"],
        executionIds: ["exec_z"], // alternative field name - not used when affectedExecutions is present
    };
    const event = makeEvent("evt_exec_link", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    // Only affectedExecutions is used (executionIds is fallback)
    assert.deepEqual(state.affectedExecutions, ["exec_x", "exec_y"]);
});
test("incidentProjectionHandler uses executionIds when affectedExecutions is missing", () => {
    const payload = {
        incidentId: "inc_exec_alt",
        executionIds: ["exec_alt_1", "exec_alt_2"],
    };
    const event = makeEvent("evt_exec_link_alt", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    assert.deepEqual(state.affectedExecutions, ["exec_alt_1", "exec_alt_2"]);
});
test("incidentProjectionHandler links affected workers", () => {
    const payload = {
        incidentId: "inc_worker",
        affectedWorkers: ["worker_1", "worker_2"],
        workerIds: ["worker_3"], // alternative field name - not used when affectedWorkers is present
    };
    const event = makeEvent("evt_worker_link", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    // Only affectedWorkers is used (workerIds is fallback)
    assert.deepEqual(state.affectedWorkers, ["worker_1", "worker_2"]);
});
test("incidentProjectionHandler uses workerIds when affectedWorkers is missing", () => {
    const payload = {
        incidentId: "inc_worker_alt",
        workerIds: ["worker_alt_1", "worker_alt_2"],
    };
    const event = makeEvent("evt_worker_link_alt", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    assert.deepEqual(state.affectedWorkers, ["worker_alt_1", "worker_alt_2"]);
});
test("incidentProjectionHandler links affected rollouts", () => {
    const payload = {
        incidentId: "inc_rollout",
        affectedRollouts: ["rollout_1"],
        rolloutIds: ["rollout_2"], // alternative field name - not used when affectedRollouts is present
    };
    const event = makeEvent("evt_rollout_link", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    // Only affectedRollouts is used (rolloutIds is fallback)
    assert.deepEqual(state.affectedRollouts, ["rollout_1"]);
});
test("incidentProjectionHandler uses rolloutIds when affectedRollouts is missing", () => {
    const payload = {
        incidentId: "inc_rollout_alt",
        rolloutIds: ["rollout_alt_1", "rollout_alt_2"],
    };
    const event = makeEvent("evt_rollout_link_alt", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    assert.deepEqual(state.affectedRollouts, ["rollout_alt_1", "rollout_alt_2"]);
});
test("incidentProjectionHandler links affected repair jobs", () => {
    const payload = {
        incidentId: "inc_repair",
        affectedRepairJobs: ["repair_1"],
        repairJobIds: ["repair_2"], // alternative field name - not used when affectedRepairJobs is present
    };
    const event = makeEvent("evt_repair_link", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    // Only affectedRepairJobs is used (repairJobIds is fallback)
    assert.deepEqual(state.affectedRepairJobs, ["repair_1"]);
});
test("incidentProjectionHandler uses repairJobIds when affectedRepairJobs is missing", () => {
    const payload = {
        incidentId: "inc_repair_alt",
        repairJobIds: ["repair_alt_1", "repair_alt_2"],
    };
    const event = makeEvent("evt_repair_link_alt", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    assert.deepEqual(state.affectedRepairJobs, ["repair_alt_1", "repair_alt_2"]);
});
test("incidentProjectionHandler deduplicates affected entities", () => {
    const event1 = makeEvent("evt_entity_1", "incident:created", null, JSON.stringify({ incidentId: "inc_dedup", affectedWorkflows: ["wf_1"] }));
    const event2 = makeEvent("evt_entity_2", "incident:acknowledged", null, JSON.stringify({ affectedWorkflows: ["wf_1", "wf_2"] }));
    const state1 = incidentProjectionHandler(null, event1);
    const state2 = incidentProjectionHandler(state1, event2);
    assert.deepEqual(state2.affectedWorkflows, ["wf_1", "wf_2"]);
});
// =============================================================================
// Timeline Tests
// =============================================================================
test("incidentProjectionHandler accumulates timeline in order", () => {
    const events = [
        makeEvent("evt_tl_a", "incident:created", null, JSON.stringify({ incidentId: "inc_tl" }), "2026-04-19T10:00:00.000Z"),
        makeEvent("evt_tl_b", "incident:acknowledged", null, JSON.stringify({}), "2026-04-19T10:01:00.000Z"),
    ];
    let state = null;
    for (const event of events) {
        state = incidentProjectionHandler(state, event);
    }
    const finalState = state;
    assert.equal(finalState.timeline.length, 2);
    assert.equal(finalState.timeline[0].eventId, "evt_tl_a");
    assert.equal(finalState.timeline[1].eventId, "evt_tl_b");
    assert.equal(finalState.timeline[0].eventType, "incident:created");
    assert.equal(finalState.timeline[1].eventType, "incident:acknowledged");
});
test("incidentProjectionHandler timeline includes actorId and action", () => {
    const payload = {
        incidentId: "inc_tl_actor",
        actorId: "operator_42",
        action: "acknowledged",
        actionDetails: { note: "Looking into this" },
    };
    const event = makeEvent("evt_tl_actor", "incident:acknowledged", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.timeline.length, 1);
    assert.equal(state.timeline[0].actorId, "operator_42");
    assert.equal(state.timeline[0].action, "acknowledged");
    assert.deepEqual(state.timeline[0].details, { note: "Looking into this" });
});
test("incidentProjectionHandler timeline entry has correct timestamp", () => {
    const event = makeEvent("evt_tl_ts", "incident:created", null, JSON.stringify({ incidentId: "inc_tl_ts" }), "2026-04-19T15:30:00.000Z");
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.timeline[0].timestamp, "2026-04-19T15:30:00.000Z");
});
// =============================================================================
// Unknown Event Type Tests
// =============================================================================
test("incidentProjectionHandler handles unknown event types gracefully", () => {
    const event = makeEvent("evt_unknown", "unknown:event_type", null, JSON.stringify({ some: "data" }));
    const state = incidentProjectionHandler(null, event);
    // Should still update basic tracking
    assert.equal(state.eventCount, 1);
    assert.equal(state.timeline.length, 1);
    assert.deepEqual(state.processedEventIds, ["evt_unknown"]);
    assert.equal(state.status, "detected"); // Default status unchanged
});
test("incidentProjectionHandler preserves state on unknown event", () => {
    const event1 = makeEvent("evt_known", "incident:created", null, JSON.stringify({ incidentId: "inc_unknown", severity: "high" }));
    const event2 = makeEvent("evt_unknown", "random:event", null, JSON.stringify({}));
    const state1 = incidentProjectionHandler(null, event1);
    const state2 = incidentProjectionHandler(state1, event2);
    assert.equal(state2.incidentId, "inc_unknown");
    assert.equal(state2.severity, "high");
    assert.equal(state2.eventCount, 2);
});
// =============================================================================
// State Transition Flow Tests
// =============================================================================
test("incidentProjectionHandler handles full incident lifecycle", () => {
    const events = [
        makeEvent("evt_lc_1", "incident:created", null, JSON.stringify({ incidentId: "inc_lifecycle", severity: "critical" }), "2026-04-19T08:00:00.000Z"),
        makeEvent("evt_lc_2", "incident:acknowledged", null, JSON.stringify({}), "2026-04-19T08:05:00.000Z"),
        makeEvent("evt_lc_3", "incident:investigating", null, JSON.stringify({ rootCause: "Database connection pool exhausted" }), "2026-04-19T08:10:00.000Z"),
        makeEvent("evt_lc_4", "incident:mitigated", null, JSON.stringify({ rootCause: "Connection pool size increased" }), "2026-04-19T08:30:00.000Z"),
        makeEvent("evt_lc_5", "incident:resolved", null, JSON.stringify({}), "2026-04-19T09:00:00.000Z"),
    ];
    let state = null;
    for (const event of events) {
        state = incidentProjectionHandler(state, event);
    }
    const finalState = state;
    assert.equal(finalState.status, "resolved");
    assert.equal(finalState.severity, "critical");
    assert.equal(finalState.detectedAt, "2026-04-19T08:00:00.000Z");
    assert.equal(finalState.acknowledgedAt, "2026-04-19T08:05:00.000Z");
    assert.equal(finalState.resolvedAt, "2026-04-19T09:00:00.000Z");
    assert.equal(finalState.rootCause, "Database connection pool exhausted");
    assert.equal(finalState.eventCount, 5);
    assert.equal(finalState.timeline.length, 5);
});
test("incidentProjectionHandler handles cancelled incident flow", () => {
    const events = [
        makeEvent("evt_cancel_1", "incident:created", null, JSON.stringify({ incidentId: "inc_cancel" }), "2026-04-19T10:00:00.000Z"),
        makeEvent("evt_cancel_2", "incident:cancelled", null, JSON.stringify({ reason: "False positive" }), "2026-04-19T10:15:00.000Z"),
    ];
    let state = null;
    for (const event of events) {
        state = incidentProjectionHandler(state, event);
    }
    const finalState = state;
    assert.equal(finalState.status, "cancelled");
    assert.equal(finalState.resolvedAt, "2026-04-19T10:15:00.000Z");
});
// =============================================================================
// createIncidentProjectionHandler Tests
// =============================================================================
test("createIncidentProjectionHandler returns handler function", () => {
    const handler = createIncidentProjectionHandler();
    assert.equal(typeof handler, "function");
    const event = makeEvent("evt_factory", "incident:created", null, JSON.stringify({ incidentId: "inc_factory" }));
    const state = handler(null, event);
    assert.equal(state.incidentId, "inc_factory");
});
test("createIncidentProjectionHandler handler produces correct state", () => {
    const handler = createIncidentProjectionHandler();
    const event = makeEvent("evt_factory_correct", "incident:created", null, JSON.stringify({ incidentId: "inc_correct", severity: "medium" }));
    const state = handler(null, event);
    assert.equal(state.incidentId, "inc_correct");
    assert.equal(state.severity, "medium");
    assert.equal(state.status, "detected");
    assert.equal(state.eventCount, 1);
});
// =============================================================================
// Edge Cases
// =============================================================================
test("incidentProjectionHandler handles empty payload", () => {
    const event = makeEvent("evt_empty", "incident:created", null, "{}");
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.incidentId, null);
    assert.equal(state.severity, null);
    assert.equal(state.description, null);
    assert.equal(state.eventCount, 1);
});
test("incidentProjectionHandler handles invalid JSON payload", () => {
    const event = makeEvent("evt_invalid_json", "incident:created", null, "not valid json {");
    const state = incidentProjectionHandler(null, event);
    // Should not crash, just treat as empty payload
    assert.equal(state.incidentId, null);
    assert.equal(state.eventCount, 1);
});
test("incidentProjectionHandler handles null values in payload", () => {
    const event = makeEvent("evt_nulls", "incident:created", null, JSON.stringify({
        incidentId: null,
        severity: null,
        description: null,
    }));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.incidentId, null);
    assert.equal(state.severity, null);
    assert.equal(state.description, null);
});
test("incidentProjectionHandler does not overwrite existing incidentId", () => {
    const event1 = makeEvent("evt_id_1", "incident:created", null, JSON.stringify({ incidentId: "inc_first" }));
    const event2 = makeEvent("evt_id_2", "incident:acknowledged", null, JSON.stringify({ incidentId: "inc_second" }));
    const state1 = incidentProjectionHandler(null, event1);
    const state2 = incidentProjectionHandler(state1, event2);
    assert.equal(state2.incidentId, "inc_first");
});
test("incidentProjectionHandler does not overwrite existing severity", () => {
    const event1 = makeEvent("evt_sev_1", "incident:created", null, JSON.stringify({ severity: "high" }));
    const event2 = makeEvent("evt_sev_2", "incident:acknowledged", null, JSON.stringify({ severity: "critical" }));
    const state1 = incidentProjectionHandler(null, event1);
    const state2 = incidentProjectionHandler(state1, event2);
    assert.equal(state2.severity, "high");
});
test("incidentProjectionHandler does not overwrite existing description", () => {
    const event1 = makeEvent("evt_desc_1", "incident:created", null, JSON.stringify({ description: "Original description" }));
    const event2 = makeEvent("evt_desc_2", "incident:acknowledged", null, JSON.stringify({ description: "New description" }));
    const state1 = incidentProjectionHandler(null, event1);
    const state2 = incidentProjectionHandler(state1, event2);
    assert.equal(state2.description, "Original description");
});
test("incidentProjectionHandler tracks failedAt implicitly through resolvedAt for cancelled", () => {
    const event = makeEvent("evt_cancel_track", "incident:cancelled", null, JSON.stringify({}));
    const state = incidentProjectionHandler(null, event);
    assert.equal(state.status, "cancelled");
    assert.equal(state.resolvedAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.eventCount, 1);
});
test("incidentProjectionHandler handles multiple entity types in same event", () => {
    const payload = {
        incidentId: "inc_multi_entity",
        affectedWorkflows: ["wf_1"],
        affectedExecutions: ["exec_1"],
        affectedWorkers: ["worker_1"],
        affectedRollouts: ["rollout_1"],
        affectedRepairJobs: ["repair_1"],
    };
    const event = makeEvent("evt_multi_entity", "incident:created", null, JSON.stringify(payload));
    const state = incidentProjectionHandler(null, event);
    assert.deepEqual(state.affectedWorkflows, ["wf_1"]);
    assert.deepEqual(state.affectedExecutions, ["exec_1"]);
    assert.deepEqual(state.affectedWorkers, ["worker_1"]);
    assert.deepEqual(state.affectedRollouts, ["rollout_1"]);
    assert.deepEqual(state.affectedRepairJobs, ["repair_1"]);
});
test("incidentProjectionHandler preserves existing state when handling events", () => {
    const event1 = makeEvent("evt_preserve_1", "incident:created", null, JSON.stringify({
        incidentId: "inc_preserve",
        severity: "high",
        affectedWorkflows: ["wf_preserve"],
    }));
    const event2 = makeEvent("evt_preserve_2", "incident:acknowledged", null, JSON.stringify({}));
    const state1 = incidentProjectionHandler(null, event1);
    const state2 = incidentProjectionHandler(state1, event2);
    // All should be preserved
    assert.equal(state2.incidentId, "inc_preserve");
    assert.equal(state2.severity, "high");
    assert.deepEqual(state2.affectedWorkflows, ["wf_preserve"]);
    assert.equal(state2.status, "acknowledged");
    assert.equal(state2.eventCount, 2);
});
//# sourceMappingURL=incident-projection.test.js.map