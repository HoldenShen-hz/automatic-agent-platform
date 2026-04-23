/**
 * Unit tests for RiskActionProjection
 *
 * Tests projection state management for risk decision events.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 */
import test from "node:test";
import assert from "node:assert/strict";
import { riskActionProjectionHandler, createEmptyRiskActionState, createRiskActionProjectionHandler, } from "../../../../../../src/platform/state-evidence/events/projections/risk-action-projection.js";
function makeEvent(eventId, eventType, taskId = null, payloadJson = "{}", createdAt = "2026-04-19T10:00:00.000Z") {
    return { eventId, eventType, taskId, payloadJson, createdAt };
}
test("createEmptyRiskActionState returns correct initial state", () => {
    const state = createEmptyRiskActionState();
    assert.equal(state.riskDecisionId, null);
    assert.equal(state.taskId, null);
    assert.equal(state.executionId, null);
    assert.equal(state.workflowId, null);
    assert.equal(state.riskLevel, null);
    assert.equal(state.action, null);
    assert.equal(state.status, "pending");
    assert.deepEqual(state.policyIds, []);
    assert.equal(state.riskScore, null);
    assert.equal(state.confirmed, false);
    assert.equal(state.overridden, false);
    assert.equal(state.overrideReason, null);
    assert.equal(state.overriddenBy, null);
    assert.equal(state.decidedAt, null);
    assert.equal(state.completedAt, null);
    assert.deepEqual(state.timeline, []);
    assert.equal(state.eventCount, 0);
    assert.deepEqual(state.processedEventIds, []);
});
test("riskActionProjectionHandler handles risk:decision_requested", () => {
    const payload = {
        riskDecisionId: "risk_001",
        taskId: "task_risk_1",
        riskLevel: "high",
    };
    const event = makeEvent("evt_req", "risk:decision_requested", "task_risk_1", JSON.stringify(payload));
    const state = riskActionProjectionHandler(null, event);
    assert.equal(state.riskDecisionId, "risk_001");
    assert.equal(state.status, "pending");
    assert.equal(state.riskLevel, "high");
    assert.equal(state.firstEventAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.eventCount, 1);
});
test("riskActionProjectionHandler handles risk:decision_made", () => {
    const payload = {
        riskDecisionId: "risk_decision_1",
        action: "allow",
        riskScore: 0.3,
    };
    const event = makeEvent("evt_made", "risk:decision_made", "task_made", JSON.stringify(payload));
    const state = riskActionProjectionHandler(null, event);
    assert.equal(state.status, "decided");
    assert.equal(state.action, "allow");
    assert.equal(state.riskScore, 0.3);
    assert.equal(state.decidedAt, "2026-04-19T10:00:00.000Z");
});
test("riskActionProjectionHandler handles risk:action_confirmed", () => {
    const payload = {
        riskDecisionId: "risk_confirm_1",
    };
    const event = makeEvent("evt_confirm", "risk:action_confirmed", "task_confirm", JSON.stringify(payload));
    const state = riskActionProjectionHandler(null, event);
    assert.equal(state.status, "confirmed");
    assert.equal(state.confirmed, true);
});
test("riskActionProjectionHandler handles risk:action_overridden", () => {
    const payload = {
        riskDecisionId: "risk_override_1",
        reason: "Manual override due to context",
        overriddenBy: "admin_user",
    };
    const event = makeEvent("evt_override", "risk:action_overridden", "task_override", JSON.stringify(payload));
    const state = riskActionProjectionHandler(null, event);
    assert.equal(state.status, "overridden");
    assert.equal(state.overridden, true);
    assert.equal(state.overrideReason, "Manual override due to context");
    assert.equal(state.overriddenBy, "admin_user");
});
test("riskActionProjectionHandler handles risk:action_completed", () => {
    const payload = {
        riskDecisionId: "risk_complete_1",
    };
    const event = makeEvent("evt_complete", "risk:action_completed", "task_complete", JSON.stringify(payload));
    const state = riskActionProjectionHandler(null, event);
    assert.equal(state.status, "completed");
    assert.equal(state.completedAt, "2026-04-19T10:00:00.000Z");
});
test("riskActionProjectionHandler handles risk:quota_exceeded", () => {
    const payload = {
        riskDecisionId: "risk_quota_1",
    };
    const event = makeEvent("evt_quota", "risk:quota_exceeded", "task_quota", JSON.stringify(payload));
    const state = riskActionProjectionHandler(null, event);
    assert.equal(state.status, "decided");
    assert.equal(state.action, "block");
    assert.equal(state.decidedAt, "2026-04-19T10:00:00.000Z");
});
test("riskActionProjectionHandler handles compliance:violation_detected", () => {
    const payload = {
        violationId: "violation_001",
        severity: "critical",
        taskId: "task_violation",
    };
    const event = makeEvent("evt_violation", "compliance:violation_detected", "task_violation", JSON.stringify(payload));
    const state = riskActionProjectionHandler(null, event);
    assert.equal(state.status, "decided");
    assert.equal(state.action, "quarantine");
    assert.equal(state.riskLevel, "critical");
});
test("riskActionProjectionHandler extracts workflowId from payload", () => {
    const payload = {
        riskDecisionId: "risk_wf_1",
        workflowId: "workflow_from_payload",
    };
    const event = makeEvent("evt_wf", "risk:decision_made", null, JSON.stringify(payload));
    const state = riskActionProjectionHandler(null, event);
    assert.equal(state.workflowId, "workflow_from_payload");
});
test("riskActionProjectionHandler accumulates policyIds", () => {
    const payload1 = { riskDecisionId: "risk_policy_1", policyId: "policy_a" };
    const event1 = makeEvent("evt_pol_1", "risk:decision_made", "task_pol", JSON.stringify(payload1));
    const state1 = riskActionProjectionHandler(null, event1);
    assert.deepEqual(state1.policyIds, ["policy_a"]);
    const payload2 = { policyIds: ["policy_b", "policy_c"] };
    const event2 = makeEvent("evt_pol_2", "risk:action_confirmed", "task_pol", JSON.stringify(payload2));
    const state2 = riskActionProjectionHandler(state1, event2);
    assert.deepEqual(state2.policyIds, ["policy_a", "policy_b", "policy_c"]);
});
test("riskActionProjectionHandler is idempotent - same event applied twice", () => {
    const event = makeEvent("evt_idem", "risk:decision_requested", "task_idem", '{"riskDecisionId":"idempotent_1"}');
    const state1 = riskActionProjectionHandler(null, event);
    const state2 = riskActionProjectionHandler(state1, event);
    assert.equal(state2.eventCount, 1);
    assert.deepEqual(state2.processedEventIds, ["evt_idem"]);
});
test("riskActionProjectionHandler builds timeline in order", () => {
    const events = [
        makeEvent("evt_1", "risk:decision_requested", "task_timeline", '{"riskDecisionId":"timeline_1"}', "2026-04-19T10:00:00.000Z"),
        makeEvent("evt_2", "risk:decision_made", "task_timeline", '{"action":"deny"}', "2026-04-19T10:01:00.000Z"),
        makeEvent("evt_3", "risk:action_completed", "task_timeline", '{}', "2026-04-19T10:02:00.000Z"),
    ];
    let state = null;
    for (const event of events) {
        state = riskActionProjectionHandler(state, event);
    }
    const finalState = state;
    assert.equal(finalState.timeline.length, 3);
    assert.equal(finalState.eventCount, 3);
    assert.equal(finalState.timeline[0].eventId, "evt_1");
    assert.equal(finalState.timeline[2].action, null); // No action for decision_requested
});
test("riskActionProjectionHandler extracts riskScore from alternate field names", () => {
    const payload1 = { riskDecisionId: "risk_alt_1", risk_score: 0.5 };
    const event1 = makeEvent("evt_alt_1", "risk:decision_made", null, JSON.stringify(payload1));
    const state1 = riskActionProjectionHandler(null, event1);
    assert.equal(state1.riskScore, 0.5);
    const payload2 = { riskDecisionId: "risk_alt_2", score: 0.7 };
    const event2 = makeEvent("evt_alt_2", "risk:decision_made", null, JSON.stringify(payload2));
    const state2 = riskActionProjectionHandler(null, event2);
    assert.equal(state2.riskScore, 0.7);
});
test("riskActionProjectionHandler handles unknown event types gracefully", () => {
    const event = makeEvent("evt_unknown", "unknown:event", "task_unknown", '{"some":"data"}');
    const state = riskActionProjectionHandler(null, event);
    assert.equal(state.eventCount, 1);
    assert.equal(state.timeline.length, 1);
});
test("createRiskActionProjectionHandler returns handler function", () => {
    const handler = createRiskActionProjectionHandler();
    assert.equal(typeof handler, "function");
    const event = makeEvent("evt_test", "risk:decision_requested", null, '{"riskDecisionId":"test_handler"}');
    const state = handler(null, event);
    assert.equal(state.riskDecisionId, "test_handler");
});
//# sourceMappingURL=risk-action-projection.test.js.map