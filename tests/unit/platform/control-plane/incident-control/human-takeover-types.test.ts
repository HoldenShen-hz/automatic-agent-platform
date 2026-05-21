import test from "node:test";
import assert from "node:assert/strict";

import type {
  ManualOverride,
  IncidentContextBundle,
  TakeoverActionResult,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-types.js";

test("ManualOverride structure with all action types", () => {
  const actionTypes = [
    "input_modification",
    "worker_switch",
    "step_skip",
    "task_complete",
    "execution_retry",
    "step_modification",
  ] as const;

  for (const actionType of actionTypes) {
    const override: ManualOverride = {
      overrideId: `override_${actionType}`,
      taskId: "task_123",
      executionId: "exec_456",
      operatorId: "operator_789",
      actionType,
      reasonCode: "OPERATOR_REQUEST",
      targetStage: "execute",
      overridePayloadJson: '{"key": "value"}',
      feedbackSignalInjected: false,
      improvementCandidateCreated: false,
      createdAt: "2026-04-14T00:00:00.000Z",
      traceId: "trace_abc",
    };

    assert.equal(override.actionType, actionType);
    assert.equal(override.taskId, "task_123");
  }
});

test("ManualOverride allows null executionId", () => {
  const override: ManualOverride = {
    overrideId: "override_1",
    taskId: "task_123",
    executionId: null,
    operatorId: "operator_789",
    actionType: "task_complete",
    reasonCode: "MANUAL_COMPLETION",
    targetStage: null,
    overridePayloadJson: "{}",
    feedbackSignalInjected: true,
    improvementCandidateCreated: false,
    createdAt: "2026-04-14T00:00:00.000Z",
    traceId: null,
  };

  assert.equal(override.executionId, null);
  assert.equal(override.targetStage, null);
  assert.equal(override.traceId, null);
});

test("ManualOverride all target stages", () => {
  const stages: ManualOverride["targetStage"][] = [
    "observe",
    "assess",
    "plan",
    "execute",
    "feedback",
    "learn",
    "improve",
    "release",
    null,
  ];

  for (const stage of stages) {
    const override: ManualOverride = {
      overrideId: `override_${stage ?? "null"}`,
      taskId: "task_123",
      executionId: "exec_456",
      operatorId: "operator_789",
      actionType: "task_complete",
      reasonCode: "TEST",
      targetStage: stage,
      overridePayloadJson: "{}",
      feedbackSignalInjected: false,
      improvementCandidateCreated: false,
      createdAt: "2026-04-14T00:00:00.000Z",
      traceId: null,
    };
    assert.equal(override.targetStage, stage);
  }
});

test("IncidentContextBundle structure", () => {
  const bundle: IncidentContextBundle = {
    bundleId: "bundle_123",
    incidentId: "incident_456",
    taskId: "task_789",
    executionId: "exec_abc",
    overrideIds: ["override_1", "override_2"],
    takeoverSessionIds: ["session_1"],
    operatorIds: ["operator_x"],
    severity: "high",
    status: "active",
    createdAt: "2026-04-14T00:00:00.000Z",
    resolvedAt: null,
    metadataJson: '{"key": "value"}',
  };

  assert.equal(bundle.bundleId, "bundle_123");
  assert.equal(bundle.incidentId, "incident_456");
  assert.equal(bundle.severity, "high");
  assert.equal(bundle.status, "active");
  assert.equal(bundle.overrideIds.length, 2);
  assert.equal(bundle.resolvedAt, null);
});

test("IncidentContextBundle severity levels", () => {
  const severities: IncidentContextBundle["severity"][] = ["low", "medium", "high", "critical"];

  for (const severity of severities) {
    const bundle: IncidentContextBundle = {
      bundleId: `bundle_${severity}`,
      incidentId: null,
      taskId: "task_123",
      executionId: null,
      overrideIds: [],
      takeoverSessionIds: [],
      operatorIds: [],
      severity,
      status: "active",
      createdAt: "2026-04-14T00:00:00.000Z",
      resolvedAt: null,
      metadataJson: null,
    };
    assert.equal(bundle.severity, severity);
  }
});

test("IncidentContextBundle status values", () => {
  const statuses: IncidentContextBundle["status"][] = ["active", "resolved", "cancelled"];

  for (const status of statuses) {
    const bundle: IncidentContextBundle = {
      bundleId: `bundle_${status}`,
      incidentId: null,
      taskId: "task_123",
      executionId: null,
      overrideIds: [],
      takeoverSessionIds: [],
      operatorIds: [],
      severity: "medium",
      status,
      createdAt: "2026-04-14T00:00:00.000Z",
      resolvedAt: status === "resolved" ? "2026-04-14T01:00:00.000Z" : null,
      metadataJson: null,
    };
    assert.equal(bundle.status, status);
  }
});

test("IncidentContextBundle allows empty arrays for ids", () => {
  const bundle: IncidentContextBundle = {
    bundleId: "bundle_empty",
    incidentId: null,
    taskId: "task_123",
    executionId: null,
    overrideIds: [],
    takeoverSessionIds: [],
    operatorIds: [],
    severity: "low",
    status: "active",
    createdAt: "2026-04-14T00:00:00.000Z",
    resolvedAt: null,
    metadataJson: null,
  };

  assert.equal(bundle.overrideIds.length, 0);
  assert.equal(bundle.takeoverSessionIds.length, 0);
  assert.equal(bundle.operatorIds.length, 0);
});

test("IncidentContextBundle allows readonly arrays", () => {
  const bundle: IncidentContextBundle = {
    bundleId: "bundle_readonly",
    incidentId: null,
    taskId: "task_123",
    executionId: null,
    overrideIds: Object.freeze(["override_1"]),
    takeoverSessionIds: Object.freeze(["session_1"]),
    operatorIds: Object.freeze(["operator_1"]),
    severity: "high",
    status: "active",
    createdAt: "2026-04-14T00:00:00.000Z",
    resolvedAt: null,
    metadataJson: null,
  };

  assert.equal(bundle.overrideIds.length, 1);
  assert.ok(Array.isArray(bundle.overrideIds));
});

test("TakeoverActionResult structure", () => {
  const result: TakeoverActionResult = {
    taskId: "task_123",
    executionId: "exec_456",
    takeoverSessionId: "session_789",
    operatorActionId: "action_abc",
  };

  assert.equal(result.taskId, "task_123");
  assert.equal(result.executionId, "exec_456");
  assert.equal(result.takeoverSessionId, "session_789");
  assert.equal(result.operatorActionId, "action_abc");
});

test("TakeoverActionResult allows null executionId", () => {
  const result: TakeoverActionResult = {
    taskId: "task_123",
    executionId: null,
    takeoverSessionId: "session_789",
    operatorActionId: "action_abc",
  };

  assert.equal(result.executionId, null);
});

test("ManualOverride creates improvement candidate flag", () => {
  const override: ManualOverride = {
    overrideId: "override_improve",
    taskId: "task_123",
    executionId: "exec_456",
    operatorId: "operator_789",
    actionType: "step_modification",
    reasonCode: "IMPROVEMENT",
    targetStage: "improve",
    overridePayloadJson: '{"improvement": true}',
    feedbackSignalInjected: true,
    improvementCandidateCreated: true,
    createdAt: "2026-04-14T00:00:00.000Z",
    traceId: "trace_xyz",
  };

  assert.equal(override.improvementCandidateCreated, true);
  assert.equal(override.feedbackSignalInjected, true);
});

test("ManualOverride with feedback signal injection", () => {
  const override: ManualOverride = {
    overrideId: "override_feedback",
    taskId: "task_123",
    executionId: "exec_456",
    operatorId: "operator_789",
    actionType: "input_modification",
    reasonCode: "CORRECTION",
    targetStage: "execute",
    overridePayloadJson: '{"corrected": true}',
    feedbackSignalInjected: true,
    improvementCandidateCreated: false,
    createdAt: "2026-04-14T00:00:00.000Z",
    traceId: null,
  };

  assert.equal(override.feedbackSignalInjected, true);
  assert.equal(override.improvementCandidateCreated, false);
});