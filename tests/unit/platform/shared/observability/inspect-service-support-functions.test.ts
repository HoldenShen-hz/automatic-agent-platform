/**
 * Unit tests for inspect-service-support.ts utilities.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  parseJsonArray,
  findActiveExecutionId,
  enrichDispatchDecisionTrace,
  buildRemoteRoutingSummary,
  buildLeaseHandoverSummary,
  buildStepResultEnvelopes,
} from "../../../../../src/platform/shared/observability/inspect-service-support.js";
import type { DispatchDecisionTrace, DispatchWorkerEvaluation } from "../../../../../src/platform/contracts/types/domain.js";
import type { ArtifactRecord } from "../../../../../src/platform/contracts/types/domain.js";

test("parseJsonArray parses valid JSON array string", () => {
  const result = parseJsonArray('["item1", "item2", "item3"]');
  assert.deepEqual(result, ["item1", "item2", "item3"]);
});

test("parseJsonArray handles empty array", () => {
  const result = parseJsonArray("[]");
  assert.deepEqual(result, []);
});

test("parseJsonArray handles null elements", () => {
  const result = parseJsonArray('["a", null, "b"]');
  assert.deepEqual(result, ["a", "", "b"]);
});

test("parseJsonArray returns empty array for invalid JSON", () => {
  const result = parseJsonArray("not a valid json array");
  assert.deepEqual(result, []);
});

test("parseJsonArray handles non-array JSON", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepEqual(result, []);
});

test("parseJsonArray handles empty string", () => {
  const result = parseJsonArray("");
  assert.deepEqual(result, []);
});

test("findActiveExecutionId returns last non-terminal execution", () => {
  const executions = [
    { id: "exec-1", status: "succeeded" },
    { id: "exec-2", status: "failed" },
    { id: "exec-3", status: "executing" },
    { id: "exec-4", status: "created" },
  ];

  const result = findActiveExecutionId(executions);
  assert.equal(result, "exec-4");
});

test("findActiveExecutionId returns null when all terminal", () => {
  const executions = [
    { id: "exec-1", status: "succeeded" },
    { id: "exec-2", status: "failed" },
    { id: "exec-3", status: "cancelled" },
  ];

  const result = findActiveExecutionId(executions);
  assert.equal(result, null);
});

test("findActiveExecutionId returns null for empty array", () => {
  const result = findActiveExecutionId([]);
  assert.equal(result, null);
});

test("findActiveExecutionId skips superseded executions", () => {
  const executions = [
    { id: "exec-1", status: "superseded" },
    { id: "exec-2", status: "executing" },
  ];

  const result = findActiveExecutionId(executions);
  assert.equal(result, "exec-2");
});

test("enrichDispatchDecisionTrace adds accepted/rejected worker ids", () => {
  const decision: DispatchDecisionTrace = {
    ticketId: "ticket-1",
    executionId: "exec-1",
    taskId: "task-1",
    queueName: "primary",
    dispatchTarget: "prefer_remote",
    remoteAvailability: "healthy",
    requiredIsolationLevel: null,
    requiredRepoVersion: null,
    preferredWorkerId: null,
    requiredCapabilities: [],
    outcome: "dispatched",
    reasonCode: null,
    selectedWorkerId: "worker-remote-1",
    leaseId: "lease-1",
    fallbackApplied: false,
    preemption: null,
    evaluations: [
      {
        workerId: "worker-remote-1",
        status: "idle",
        schedulingStatus: "schedulable",
        placement: "remote",
        isolationLevel: null,
        repoVersion: null,
        remoteSessionStatus: "active",
        lastAcknowledgedStreamOffset: null,
        sessionConsistencyCheckStatus: null,
        workspaceSyncStatus: null,
        queueAffinity: null,
        availableSlots: 1,
        accepted: true,
        rejectionReason: null,
        missingCapabilities: [],
      },
      {
        workerId: "worker-local-1",
        status: "idle",
        schedulingStatus: "schedulable",
        placement: "local",
        isolationLevel: null,
        repoVersion: null,
        remoteSessionStatus: null,
        lastAcknowledgedStreamOffset: null,
        sessionConsistencyCheckStatus: null,
        workspaceSyncStatus: null,
        queueAffinity: null,
        availableSlots: 2,
        accepted: false,
        rejectionReason: "capacity",
        missingCapabilities: [],
      },
    ],
  };

  const enriched = enrichDispatchDecisionTrace(decision);

  assert.deepEqual(enriched.acceptedWorkerIds, ["worker-remote-1"]);
  assert.deepEqual(enriched.rejectedWorkerIds, ["worker-local-1"]);
  assert.deepEqual(enriched.remoteAcceptedWorkerIds, ["worker-remote-1"]);
  assert.deepEqual(enriched.remoteRejectedWorkerIds, []);
  assert.deepEqual(enriched.localAcceptedWorkerIds, []);
  assert.deepEqual(enriched.localRejectedWorkerIds, ["worker-local-1"]);
  assert.equal(enriched.selectedWorkerPlacement, "remote");
});

test("enrichDispatchDecisionTrace handles no selected worker", () => {
  const decision: DispatchDecisionTrace = {
    ticketId: "ticket-1",
    executionId: "exec-1",
    taskId: "task-1",
    queueName: "primary",
    dispatchTarget: "require_remote",
    remoteAvailability: "unavailable",
    requiredIsolationLevel: null,
    requiredRepoVersion: null,
    preferredWorkerId: null,
    requiredCapabilities: [],
    outcome: "blocked",
    reasonCode: "require_remote_unavailable",
    selectedWorkerId: null,
    leaseId: null,
    fallbackApplied: false,
    preemption: null,
    evaluations: [],
  };

  const enriched = enrichDispatchDecisionTrace(decision);

  assert.equal(enriched.selectedWorkerId, null);
  assert.equal(enriched.selectedWorkerPlacement, null);
});

test("buildRemoteRoutingSummary aggregates decisions correctly", () => {
  const decisions = [
    {
      ticketId: "ticket-1",
      executionId: "exec-1",
      taskId: "task-1",
      queueName: "primary",
      dispatchTarget: "prefer_remote" as const,
      remoteAvailability: "healthy" as const,
      requiredCapabilities: [],
      outcome: "dispatched" as const,
      reasonCode: null,
      selectedWorkerId: "worker-remote-1",
      selectedWorkerPlacement: "remote" as const,
      acceptedWorkerIds: ["worker-remote-1"],
      rejectedWorkerIds: [],
      remoteAcceptedWorkerIds: ["worker-remote-1"],
      remoteRejectedWorkerIds: [],
      localAcceptedWorkerIds: [],
      localRejectedWorkerIds: [],
      evaluations: [] as DispatchWorkerEvaluation[],
      leaseId: null,
      fallbackApplied: false,
      preemption: null,
    },
    {
      ticketId: "ticket-2",
      executionId: "exec-1",
      taskId: "task-1",
      queueName: "primary",
      dispatchTarget: "local_only" as const,
      remoteAvailability: null,
      requiredCapabilities: [],
      outcome: "dispatched" as const,
      reasonCode: null,
      selectedWorkerId: "worker-local-1",
      selectedWorkerPlacement: "local" as const,
      acceptedWorkerIds: ["worker-local-1"],
      rejectedWorkerIds: [],
      remoteAcceptedWorkerIds: [],
      remoteRejectedWorkerIds: [],
      localAcceptedWorkerIds: ["worker-local-1"],
      localRejectedWorkerIds: [],
      evaluations: [] as DispatchWorkerEvaluation[],
      leaseId: null,
      fallbackApplied: false,
      preemption: null,
    },
  ] as any;

  const summary = buildRemoteRoutingSummary(decisions);

  assert.equal(summary.totalDecisions, 2);
  assert.equal(summary.remoteDecisionCount, 1);
  assert.equal(summary.healthyDecisionCount, 1);
  assert.equal(summary.remoteDispatchCount, 1);
  assert.equal(summary.localDispatchCount, 1);
  assert.equal(summary.latestRemoteAvailability, "healthy");
  assert.equal(summary.latestSelectedWorkerPlacement, "local");
});

test("buildRemoteRoutingSummary handles empty decisions", () => {
  const summary = buildRemoteRoutingSummary([]);

  assert.equal(summary.totalDecisions, 0);
  assert.equal(summary.remoteDecisionCount, 0);
  assert.equal(summary.healthyDecisionCount, 0);
  assert.equal(summary.latestRemoteAvailability, null);
  assert.equal(summary.latestSelectedWorkerPlacement, null);
});

test("buildLeaseHandoverSummary extracts handover events correctly", () => {
  const events = [
    {
      id: "event-1",
      taskId: "task-1",
      eventType: "worker:claim",
      eventTier: "tier_2" as const,
      payloadJson: '{"key": "value"}',
      createdAt: "2026-04-16T10:00:00.000Z",
    },
    {
      id: "event-2",
      taskId: "task-1",
      eventType: "lease:handover_recorded",
      eventTier: "tier_2" as const,
      payloadJson: '{"previousWorkerId": "worker-old", "workerId": "worker-new", "reasonCode": "lease_expired"}',
      createdAt: "2026-04-16T11:00:00.000Z",
    },
    {
      id: "event-3",
      taskId: "task-1",
      eventType: "lease:handover_recorded",
      eventTier: "tier_2" as const,
      payloadJson: '{"previousWorkerId": "worker-new", "workerId": "worker-latest", "reasonCode": null}',
      createdAt: "2026-04-16T12:00:00.000Z",
    },
  ] as any;

  const summary = buildLeaseHandoverSummary(events);

  assert.equal(summary.totalHandovers, 2);
  assert.equal(summary.latestHandoverAt, "2026-04-16T12:00:00.000Z");
  assert.equal(summary.latestReasonCode, null);
  assert.equal(summary.latestPreviousWorkerId, "worker-new");
  assert.equal(summary.latestWorkerId, "worker-latest");
  assert.deepEqual(summary.workerIds.sort(), ["worker-new", "worker-old", "worker-latest"]);
});

test("buildLeaseHandoverSummary handles invalid JSON payload", () => {
  const events = [
    {
      id: "event-1",
      taskId: "task-1",
      eventType: "lease:handover_recorded",
      eventTier: "tier_2" as const,
      payloadJson: "not valid json",
      createdAt: "2026-04-16T10:00:00.000Z",
    },
  ] as any;

  const summary = buildLeaseHandoverSummary(events);

  assert.equal(summary.totalHandovers, 1);
  assert.equal(summary.latestPreviousWorkerId, null);
  assert.equal(summary.latestWorkerId, null);
});

test("buildLeaseHandoverSummary handles empty events", () => {
  const summary = buildLeaseHandoverSummary([]);

  assert.equal(summary.totalHandovers, 0);
  assert.equal(summary.latestHandoverAt, null);
  assert.deepEqual(summary.workerIds, []);
});

test("buildLeaseHandoverSummary handles non-handover events", () => {
  const events = [
    {
      id: "event-1",
      taskId: "task-1",
      eventType: "task:created",
      eventTier: "tier_2" as const,
      payloadJson: "{}",
      createdAt: "2026-04-16T10:00:00.000Z",
    },
    {
      id: "event-2",
      taskId: "task-1",
      eventType: "worker:claim",
      eventTier: "tier_2" as const,
      payloadJson: "{}",
      createdAt: "2026-04-16T11:00:00.000Z",
    },
  ] as any;

  const summary = buildLeaseHandoverSummary(events);

  assert.equal(summary.totalHandovers, 0);
  assert.equal(summary.latestHandoverAt, null);
});

test("buildStepResultEnvelopes maps step outputs to artifacts", () => {
  const stepOutputs = [
    {
      id: "step-1",
      taskId: "task-1",
      stepId: "plan",
      roleId: "planner",
      status: "succeeded",
      dataJson: '{"result": "ok"}',
      summary: "Planning done",
      artifactsJson: null,
      tokenCost: 100,
      durationMs: 500,
      validationJson: null,
      producedAt: "2026-04-16T10:00:00.000Z",
    },
    {
      id: "step-2",
      taskId: "task-1",
      stepId: "execute",
      roleId: "executor",
      status: "succeeded",
      dataJson: '{"result": "done"}',
      summary: "Execution done",
      artifactsJson: null,
      tokenCost: 200,
      durationMs: 1000,
      validationJson: null,
      producedAt: "2026-04-16T10:05:00.000Z",
    },
  ] as any;

  const artifacts: ArtifactRecord[] = [
    {
      artifactId: "artifact-1",
      taskId: "task-1",
      executionId: "exec-1",
      stepId: "plan",
      kind: "report",
      storagePath: "/tmp/report.md",
      fileName: "report.md",
      mimeType: "text/markdown",
      sizeBytes: 1024,
      checksum: "abc123",
      lineageJson: "{}",
      createdAt: "2026-04-16T10:01:00.000Z",
    },
  ] as any;

  const envelopes = buildStepResultEnvelopes(stepOutputs, artifacts);

  assert.equal(envelopes.length, 2);
  assert.equal(envelopes[0]!.stepOutput.stepId, "plan");
  assert.equal(envelopes[0]!.artifacts.length, 1);
  assert.equal(envelopes[1]!.artifacts.length, 0);
});