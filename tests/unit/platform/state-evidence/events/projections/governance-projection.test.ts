import assert from "node:assert/strict";
import test from "node:test";

import {
  governanceProjectionHandler,
  createEmptyGovernanceState,
  createGovernanceProjectionHandler,
  type GovernanceState,
  type GovernanceActionType,
  type GovernanceStatus,
  type ProjectionInputEvent,
} from "../../../../../../src/platform/state-evidence/events/projections/governance-projection.js";

/**
 * Helper to create a projection input event
 */
function makeEvent(
  eventId: string,
  eventType: string,
  taskId: string | null = null,
  payloadJson: string = "{}",
  createdAt: string = "2026-04-19T10:00:00.000Z",
): ProjectionInputEvent {
  return {
    eventId,
    eventType,
    taskId,
    payloadJson,
    createdAt,
  };
}

test("governanceProjectionHandler initializes state correctly", () => {
  const event = makeEvent("evt_1", "policy:created", "task_1", '{"policyId":"pol_1"}');

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "pol_1");
  assert.equal(state.entityKind, "policy");
  assert.equal(state.taskId, "task_1");
  assert.equal(state.status, "active");
  assert.equal(state.eventCount, 1);
  assert.deepEqual(state.processedEventIds, new Set(["evt_1"]));
  assert.equal(state.firstEventAt, "2026-04-19T10:00:00.000Z");
  assert.equal(state.lastEventAt, "2026-04-19T10:00:00.000Z");
});

test("governanceProjectionHandler handles policy:created", () => {
  const event = makeEvent(
    "evt_policy_created",
    "policy:created",
    "task_1",
    '{"policyId":"pol_1","policyName":"Test Policy"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "pol_1");
  assert.equal(state.entityKind, "policy");
  assert.equal(state.status, "active");
  assert.equal(state.actionType, "policy_created");
  assert.equal(state.eventCount, 1);
});

test("governanceProjectionHandler handles policy:updated", () => {
  const event = makeEvent(
    "evt_policy_updated",
    "policy:updated",
    "task_1",
    '{"policyId":"pol_1","policyName":"Updated Policy"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "active");
  assert.equal(state.actionType, "policy_updated");
});

test("governanceProjectionHandler handles policy:deleted", () => {
  const event = makeEvent(
    "evt_policy_deleted",
    "policy:deleted",
    "task_1",
    '{"policyId":"pol_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "cancelled");
  assert.equal(state.actionType, "policy_deleted");
});

test("governanceProjectionHandler handles approval_flow:approved", () => {
  const event = makeEvent(
    "evt_approved",
    "approval_flow:approved",
    "task_1",
    '{"approvalId":"apr_1","actorId":"user_1","reason":"Approved"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "apr_1");
  assert.equal(state.entityKind, "approval");
  assert.equal(state.status, "approved");
  assert.equal(state.approved, true);
  assert.equal(state.actionType, "approval_granted");
  assert.equal(state.principal, "user_1");
  assert.equal(state.reason, "Approved");
});

test("governanceProjectionHandler handles approval_flow:rejected", () => {
  const event = makeEvent(
    "evt_rejected",
    "approval_flow:rejected",
    "task_1",
    '{"approvalId":"apr_1","actorId":"user_1","reasonCode":"denied"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "denied");
  assert.equal(state.approved, false);
  assert.equal(state.actionType, "approval_denied");
});

test("governanceProjectionHandler handles decision:approved", () => {
  const event = makeEvent(
    "evt_decision_approved",
    "decision:approved",
    null,
    '{"approvalId":"dec_1","principal":"system"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "approved");
  assert.equal(state.approved, true);
  assert.equal(state.actionType, "approval_granted");
});

test("governanceProjectionHandler handles decision:rejected", () => {
  const event = makeEvent(
    "evt_decision_rejected",
    "decision:rejected",
    null,
    '{"approvalId":"dec_1","principal":"system"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "denied");
  assert.equal(state.approved, false);
  assert.equal(state.actionType, "approval_denied");
});

test("governanceProjectionHandler handles delegation:created", () => {
  const event = makeEvent(
    "evt_delegation_created",
    "delegation:created",
    "task_1",
    '{"delegationId":"del_1","actorId":"user_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "del_1");
  assert.equal(state.entityKind, "delegation");
  assert.equal(state.status, "pending");
  assert.equal(state.actionType, "delegation_created");
});

test("governanceProjectionHandler handles delegation:completed", () => {
  const event = makeEvent(
    "evt_delegation_completed",
    "delegation:completed",
    "task_1",
    '{"delegationId":"del_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "completed");
  assert.equal(state.actionType, "delegation_completed");
});

test("governanceProjectionHandler handles delegation:failed", () => {
  const event = makeEvent(
    "evt_delegation_failed",
    "delegation:failed",
    "task_1",
    '{"delegationId":"del_1","reasonCode":"timeout"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "failed");
  assert.equal(state.actionType, "delegation_failed");
});

test("governanceProjectionHandler handles compliance:violation_detected", () => {
  const event = makeEvent(
    "evt_compliance_violation",
    "compliance:violation_detected",
    "task_1",
    '{"violationId":"vio_1","framework":"SOC2","reasonCode":"data_leak"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "vio_1");
  assert.equal(state.entityKind, "compliance");
  assert.equal(state.status, "pending");
  assert.equal(state.approved, false);
  assert.equal(state.complianceFramework, "SOC2");
  assert.equal(state.actionType, "compliance_violation");
});

test("governanceProjectionHandler handles compliance:resolved", () => {
  const event = makeEvent(
    "evt_compliance_resolved",
    "compliance:resolved",
    "task_1",
    '{"violationId":"vio_1","framework":"SOC2"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "resolved");
  assert.equal(state.actionType, "compliance_resolved");
});

test("governanceProjectionHandler handles permission:granted", () => {
  const event = makeEvent(
    "evt_permission_granted",
    "permission:granted",
    "task_1",
    '{"principal":"user_1","resource":"doc_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "approved");
  assert.equal(state.approved, true);
  assert.equal(state.actionType, "permission_granted");
});

test("governanceProjectionHandler handles permission:revoked", () => {
  const event = makeEvent(
    "evt_permission_revoked",
    "permission:revoked",
    "task_1",
    '{"principal":"user_1","resource":"doc_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "denied");
  assert.equal(state.approved, false);
  assert.equal(state.actionType, "permission_revoked");
});

test("governanceProjectionHandler handles role:assigned", () => {
  const event = makeEvent(
    "evt_role_assigned",
    "role:assigned",
    "task_1",
    '{"actorId":"admin_1","role":"admin"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "approved");
  assert.equal(state.actionType, "role_assigned");
  assert.equal(state.principal, "admin_1");
});

test("governanceProjectionHandler handles role:removed", () => {
  const event = makeEvent(
    "evt_role_removed",
    "role:removed",
    "task_1",
    '{"actorId":"admin_1","role":"admin"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "denied");
  assert.equal(state.actionType, "role_removed");
});

test("governanceProjectionHandler handles config:changed", () => {
  const event = makeEvent(
    "evt_config_changed",
    "config:changed",
    "task_1",
    '{"configId":"cfg_1","actorId":"admin"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "cfg_1");
  assert.equal(state.entityKind, "config");
  assert.equal(state.status, "active");
  assert.equal(state.actionType, "config_changed");
});

test("governanceProjectionHandler handles approval_flow:escalated", () => {
  const event = makeEvent(
    "evt_escalated",
    "approval_flow:escalated",
    "task_1",
    '{"approvalId":"apr_1","actorId":"manager"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "pending");
  assert.equal(state.actionType, "escalation_triggered");
});

test("governanceProjectionHandler handles config:policy_created", () => {
  const event = makeEvent(
    "evt_policy_created_alt",
    "config:policy_created",
    null,
    '{"policyId":"pol_alt","policyName":"Alt Policy"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "active");
  assert.equal(state.actionType, "policy_created");
});

test("governanceProjectionHandler handles config:policy_changed", () => {
  const event = makeEvent(
    "evt_policy_changed_alt",
    "config:policy_changed",
    null,
    '{"policyId":"pol_alt"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.status, "active");
  assert.equal(state.actionType, "policy_updated");
});

test("governanceProjectionHandler is idempotent - same event applied twice", () => {
  const event = makeEvent(
    "evt_idempotent",
    "approval_flow:approved",
    "task_1",
    '{"approvalId":"apr_1"}',
  );

  const state1 = governanceProjectionHandler(null, event) as unknown as GovernanceState;
  const state2 = governanceProjectionHandler(state1 as unknown as Record<string, unknown>, event) as unknown as GovernanceState;

  // Should only count once
  assert.equal(state2.eventCount, 1);
  assert.deepEqual(state2.processedEventIds, new Set(["evt_idempotent"]));
  assert.equal(state2.status, "approved");
});

test("governanceProjectionHandler is replay-safe - events in order", () => {
  const events: ProjectionInputEvent[] = [
    makeEvent("evt_1", "policy:created", "task_1", '{"policyId":"pol_1"}', "2026-04-19T10:00:00.000Z"),
    makeEvent("evt_2", "policy:updated", "task_1", '{"policyId":"pol_1"}', "2026-04-19T10:01:00.000Z"),
    makeEvent("evt_3", "approval_flow:approved", "task_1", '{"approvalId":"apr_1"}', "2026-04-19T10:02:00.000Z"),
  ];

  let state: Record<string, unknown> | null = null;
  for (const event of events) {
    state = governanceProjectionHandler(state, event);
  }

  const finalState = state as unknown as GovernanceState;
  assert.equal(finalState.eventCount, 3);
  assert.equal(finalState.status, "approved");
  assert.equal(finalState.timeline.length, 3);
  assert.equal(finalState.timeline[0]!.eventId, "evt_1");
  assert.equal(finalState.timeline[2]!.eventId, "evt_3");
  assert.equal(finalState.firstEventAt, "2026-04-19T10:00:00.000Z");
  assert.equal(finalState.lastEventAt, "2026-04-19T10:02:00.000Z");
});

test("governanceProjectionHandler deduplicates event_ids", () => {
  const event = makeEvent("evt_dedup", "policy:created", "task_1", '{"policyId":"pol_1"}');

  // Apply same event 3 times
  const state1 = governanceProjectionHandler(null, event) as unknown as GovernanceState;
  const state2 = governanceProjectionHandler(state1 as unknown as Record<string, unknown>, event) as unknown as GovernanceState;
  const state3 = governanceProjectionHandler(state2 as unknown as Record<string, unknown>, event) as unknown as GovernanceState;

  // Should only count once
  assert.equal(state3.eventCount, 1);
  assert.deepEqual(state3.processedEventIds, new Set(["evt_dedup"]));
});

test("governanceProjectionHandler accumulates timeline in order", () => {
  const events: ProjectionInputEvent[] = [
    makeEvent("evt_a", "policy:created", "task_1", '{"policyId":"pol_1"}', "2026-04-19T10:00:00.000Z"),
    makeEvent("evt_b", "approval_flow:approved", "task_1", '{"approvalId":"apr_1"}', "2026-04-19T10:01:00.000Z"),
  ];

  let state: Record<string, unknown> | null = null;
  for (const event of events) {
    state = governanceProjectionHandler(state, event);
  }

  const finalState = state as unknown as GovernanceState;
  assert.equal(finalState.timeline.length, 2);
  assert.equal(finalState.timeline[0]!.eventId, "evt_a");
  assert.equal(finalState.timeline[1]!.eventId, "evt_b");
});

test("governanceProjectionHandler extracts tenantId from payload", () => {
  const event = makeEvent(
    "evt_tenant",
    "policy:created",
    "task_1",
    '{"policyId":"pol_1","tenantId":"tenant_abc"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.tenantId, "tenant_abc");
});

test("governanceProjectionHandler extracts executionId from payload", () => {
  const event = makeEvent(
    "evt_exec",
    "approval_flow:approved",
    "task_1",
    '{"approvalId":"apr_1","executionId":"exec_xyz"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.executionId, "exec_xyz");
});

test("governanceProjectionHandler infers entityKind from eventType when not in payload", () => {
  const event = makeEvent(
    "evt_infer",
    "policy:created",
    null,
    '{"policyId":"pol_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityKind, "policy");
});

test("governanceProjectionHandler infers entityKind for approval events", () => {
  const event = makeEvent(
    "evt_approval",
    "decision:confirmed",
    null,
    '{"approvalId":"apr_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityKind, "approval");
});

test("governanceProjectionHandler infers entityKind for delegation events", () => {
  const event = makeEvent(
    "evt_delegation",
    "delegation:created",
    null,
    '{"delegationId":"del_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityKind, "delegation");
});

test("governanceProjectionHandler infers entityKind for compliance events", () => {
  const event = makeEvent(
    "evt_compliance",
    "compliance:violation_detected",
    null,
    '{"violationId":"vio_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityKind, "compliance");
});

test("governanceProjectionHandler infers entityKind for permission events", () => {
  const event = makeEvent(
    "evt_permission",
    "permission:granted",
    null,
    '{"principal":"user_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityKind, "permission");
});

test("governanceProjectionHandler infers entityKind for role events", () => {
  const event = makeEvent(
    "evt_role",
    "role:assigned",
    null,
    '{"actorId":"user_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityKind, "role");
});

test("governanceProjectionHandler infers entityKind for config events", () => {
  const event = makeEvent(
    "evt_config",
    "config:changed",
    null,
    '{"configId":"cfg_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityKind, "config");
});

test("governanceProjectionHandler handles unknown event types gracefully", () => {
  const event = makeEvent("evt_unknown", "unknown:event_type", "task_1", '{"some":"data"}');

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  // Should still update basic tracking
  assert.equal(state.eventCount, 1);
  assert.equal(state.timeline.length, 1);
  assert.deepEqual(state.processedEventIds, new Set(["evt_unknown"]));
});

test("governanceProjectionHandler infers actionType from payload for unknown event types", () => {
  const event = makeEvent("evt_infer_policy", "unknown:policy_change", null, '{"policyId":"pol_1"}');

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.actionType, "policy_updated");
});

test("governanceProjectionHandler infers approval action from payload for unknown event types", () => {
  const event = makeEvent("evt_infer_approval", "unknown:approval_event", null, '{"approvalId":"apr_1"}');

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.actionType, "approval_granted");
});

test("governanceProjectionHandler infers delegation action from payload for unknown event types", () => {
  const event = makeEvent("evt_infer_delegation", "unknown:delegation_event", null, '{"delegationId":"del_1"}');

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.actionType, "delegation_created");
});

test("governanceProjectionHandler infers compliance action from payload for unknown event types", () => {
  const event = makeEvent("evt_infer_compliance", "unknown:compliance_event", null, '{"violationId":"vio_1"}');

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.actionType, "compliance_violation");
});

test("governanceProjectionHandler infers permission action from payload for unknown event types", () => {
  const event = makeEvent("evt_infer_permission", "unknown:permission_event", null, '{"principal":"user_1"}');

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.actionType, "permission_granted");
});

test("governanceProjectionHandler infers role action from payload for unknown event types", () => {
  const event = makeEvent("evt_infer_role", "unknown:role_event", null, '{"actorId":"user_1"}');

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.actionType, "role_assigned");
});

test("governanceProjectionHandler preserves occurredAt from payload", () => {
  const event = makeEvent(
    "evt_occurred",
    "approval_flow:approved",
    "task_1",
    '{"approvalId":"apr_1","occurredAt":"2026-04-18T09:00:00.000Z"}',
    "2026-04-19T10:00:00.000Z",
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.occurredAt, "2026-04-18T09:00:00.000Z");
});

test("governanceProjectionHandler uses event createdAt when occurredAt not in payload", () => {
  const event = makeEvent(
    "evt_no_occurred",
    "approval_flow:approved",
    "task_1",
    '{"approvalId":"apr_1"}',
    "2026-04-19T10:00:00.000Z",
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.occurredAt, "2026-04-19T10:00:00.000Z");
});

test("governanceProjectionHandler prioritizes policyId for entityId", () => {
  const event = makeEvent(
    "evt_priority",
    "policy:created",
    null,
    '{"policyId":"pol_1","approvalId":"apr_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "pol_1");
});

test("governanceProjectionHandler uses approvalId when policyId not available", () => {
  const event = makeEvent(
    "evt_approval_only",
    "approval_flow:approved",
    null,
    '{"approvalId":"apr_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "apr_1");
});

test("governanceProjectionHandler uses delegationId when policyId and approvalId not available", () => {
  const event = makeEvent(
    "evt_delegation_only",
    "delegation:created",
    null,
    '{"delegationId":"del_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "del_1");
});

test("governanceProjectionHandler uses configId when policyId, approvalId, and delegationId not available", () => {
  const event = makeEvent(
    "evt_config_only",
    "config:changed",
    null,
    '{"configId":"cfg_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "cfg_1");
});

test("governanceProjectionHandler uses violationId when other IDs not available", () => {
  const event = makeEvent(
    "evt_violation_only",
    "compliance:violation_detected",
    null,
    '{"violationId":"vio_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.entityId, "vio_1");
});

test("governanceProjectionHandler prefers actorId over principal for principal field", () => {
  const event = makeEvent(
    "evt_actor",
    "approval_flow:approved",
    null,
    '{"approvalId":"apr_1","actorId":"actor_1","principal":"principal_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.principal, "actor_1");
});

test("governanceProjectionHandler uses principal when actorId not available", () => {
  const event = makeEvent(
    "evt_principal",
    "approval_flow:approved",
    null,
    '{"approvalId":"apr_1","principal":"principal_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.principal, "principal_1");
});

test("governanceProjectionHandler uses respondedBy when actorId and principal not available", () => {
  const event = makeEvent(
    "evt_responded",
    "approval_flow:approved",
    null,
    '{"approvalId":"apr_1","respondedBy":"responder_1"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.principal, "responder_1");
});

test("governanceProjectionHandler prefers reason over reasonCode for reason field", () => {
  const event = makeEvent(
    "evt_reason",
    "approval_flow:approved",
    null,
    '{"approvalId":"apr_1","reason":"Approved","reasonCode":"approved"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.reason, "Approved");
});

test("governanceProjectionHandler uses reasonCode when reason not available", () => {
  const event = makeEvent(
    "evt_reason_code",
    "approval_flow:approved",
    null,
    '{"approvalId":"apr_1","reasonCode":"approved"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.reason, "approved");
});

test("governanceProjectionHandler prefers framework over complianceFramework", () => {
  const event = makeEvent(
    "evt_framework",
    "compliance:violation_detected",
    null,
    '{"violationId":"vio_1","framework":"HIPAA","complianceFramework":"SOC2"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.complianceFramework, "HIPAA");
});

test("governanceProjectionHandler uses complianceFramework when framework not available", () => {
  const event = makeEvent(
    "evt_compliance_framework",
    "compliance:violation_detected",
    null,
    '{"violationId":"vio_1","complianceFramework":"SOC2"}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.equal(state.complianceFramework, "SOC2");
});

test("governanceProjectionHandler handles invalid JSON payload gracefully", () => {
  const event = makeEvent(
    "evt_invalid_json",
    "policy:created",
    null,
    'not valid json',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  // Should still process the event with empty details
  assert.equal(state.eventCount, 1);
  assert.equal(state.timeline.length, 1);
  assert.deepEqual(state.timeline[0]!.details, null);
});

test("governanceProjectionHandler excludes traceContext from details", () => {
  const event = makeEvent(
    "evt_trace",
    "policy:created",
    null,
    '{"policyId":"pol_1","traceContext":{"traceId":"abc"}}',
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;

  assert.deepEqual(state.timeline[0]!.details, { policyId: "pol_1" });
});

test("createEmptyGovernanceState returns correct initial state", () => {
  const state = createEmptyGovernanceState();

  assert.equal(state.entityId, null);
  assert.equal(state.entityKind, null);
  assert.equal(state.tenantId, null);
  assert.equal(state.taskId, null);
  assert.equal(state.executionId, null);
  assert.equal(state.actionType, null);
  assert.equal(state.status, "pending");
  assert.equal(state.principal, null);
  assert.equal(state.policyId, null);
  assert.equal(state.complianceFramework, null);
  assert.equal(state.approved, null);
  assert.equal(state.reason, null);
  assert.equal(state.occurredAt, null);
  assert.deepEqual(state.timeline, []);
  assert.equal(state.eventCount, 0);
  assert.deepEqual(state.processedEventIds, new Set());
  assert.equal(state.firstEventAt, null);
  assert.equal(state.lastEventAt, null);
});

test("createGovernanceProjectionHandler returns handler function", () => {
  const handler = createGovernanceProjectionHandler();

  assert.equal(typeof handler, "function");
  const event = makeEvent("evt_test", "policy:created", "task_test", '{"policyId":"pol_test"}');
  const state = handler(null, event);
  assert.equal((state as unknown as GovernanceState).entityId, "pol_test");
});

test("governanceProjectionHandler timeline entry contains correct fields", () => {
  const event = makeEvent(
    "evt_timeline_fields",
    "approval_flow:approved",
    "task_1",
    '{"approvalId":"apr_1","actorId":"user_1"}',
    "2026-04-19T10:00:00.000Z",
  );

  const state = governanceProjectionHandler(null, event) as unknown as GovernanceState;
  const entry = state.timeline[0]!;

  assert.equal(entry.eventId, "evt_timeline_fields");
  assert.equal(entry.eventType, "approval_flow:approved");
  assert.equal(entry.timestamp, "2026-04-19T10:00:00.000Z");
  assert.equal(entry.actorId, "user_1");
  assert.equal(entry.actionType, "approval_granted");
});

test("governanceProjectionHandler preserves timeline across multiple events", () => {
  const events: ProjectionInputEvent[] = [
    makeEvent("evt_1", "policy:created", "task_1", '{"policyId":"pol_1"}', "2026-04-19T10:00:00.000Z"),
    makeEvent("evt_2", "policy:updated", "task_1", '{"policyId":"pol_1"}', "2026-04-19T10:01:00.000Z"),
  ];

  let state: Record<string, unknown> | null = null;
  state = governanceProjectionHandler(state, events[0]!);
  state = governanceProjectionHandler(state!, events[1]!);

  const finalState = state as unknown as GovernanceState;
  assert.equal(finalState.timeline.length, 2);
  assert.equal(finalState.eventCount, 2);
  assert.equal(finalState.firstEventAt, "2026-04-19T10:00:00.000Z");
  assert.equal(finalState.lastEventAt, "2026-04-19T10:01:00.000Z");
});
