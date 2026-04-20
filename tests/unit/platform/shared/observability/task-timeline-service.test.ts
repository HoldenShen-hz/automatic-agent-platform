import assert from "node:assert/strict";
import test from "node:test";

import { TaskTimelineService } from "../../../../../src/platform/shared/observability/task-timeline-service.js";
import type { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";

function createDispatchDecision(overrides: Record<string, unknown> = {}) {
  return {
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
    selectedWorkerId: "worker-local-1",
    leaseId: "lease-1",
    fallbackApplied: true,
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
    ],
    selectedWorkerPlacement: "local",
    acceptedWorkerIds: ["worker-remote-1"],
    rejectedWorkerIds: [],
    remoteAcceptedWorkerIds: ["worker-remote-1"],
    remoteRejectedWorkerIds: [],
    localAcceptedWorkerIds: ["worker-local-1"],
    localRejectedWorkerIds: [],
    ...overrides,
  };
}

function createInspectServiceMock(options: {
  recentEvents: Array<Record<string, unknown>>;
  dispatchDecisions: Array<Record<string, unknown>>;
  remoteLogs?: Array<Record<string, unknown>>;
}): InspectService {
  return {
    getTaskInspectView(taskId: string) {
      return {
        task: {
          id: taskId,
          status: "in_progress",
        },
        workflowState: null,
        execution: {
          id: "exec-1",
          traceId: "trace-1",
        },
        session: null,
        approvals: [
          {
            id: "approval-1",
            taskId,
            executionId: "exec-1",
            status: "requested",
            requestJson: "{}",
            responseJson: null,
            timeoutPolicy: "24h",
            createdAt: "2026-04-16T10:02:00.000Z",
            respondedAt: null,
          },
        ],
        takeoverSessions: [],
        operatorActions: [],
        agentExecutions: [],
        dispatchDecisions: options.dispatchDecisions,
        remoteRoutingSummary: {},
        leaseHandoverSummary: {},
        recentEvents: options.recentEvents,
        stepOutputs: [
          {
            id: "step-1",
            taskId,
            stepId: "plan",
            roleId: "planner",
            status: "succeeded",
            dataJson: "{\"ok\":true}",
            summary: "Planning completed",
            artifactsJson: null,
            tokenCost: 12,
            durationMs: 250,
            validationJson: null,
            producedAt: "2026-04-16T10:01:00.000Z",
          },
        ],
        stepResults: [],
        taskResult: null,
        artifacts: [
          {
            artifactId: "artifact-1",
            taskId,
            executionId: "exec-1",
            stepId: "plan",
            kind: "report",
            storagePath: "/tmp/report.md",
            fileName: "report.md",
            mimeType: "text/markdown",
            sizeBytes: 42,
            checksum: "abc123",
            lineageJson: "{}",
            createdAt: "2026-04-16T10:03:00.000Z",
          },
        ],
        runtimeRecovery: {},
        recoverySummary: {
          activeExecutionId: null,
          hasTerminalTask: false,
          lastTakeoverActionType: null,
        },
      } as never;
    },
    listRemoteLogsByTask() {
      return (options.remoteLogs ?? []) as never;
    },
  } as unknown as InspectService;
}

test("TaskTimelineService builds a sorted timeline across events, dispatches, artifacts, approvals, and remote logs", () => {
  const inspectService = createInspectServiceMock({
    recentEvents: [
      {
        id: "event-worker",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "worker:claim_rejected",
        eventTier: "tier_2",
        payloadJson: "{\"reasonCode\":\"remote_session_inactive\",\"remoteSessionStatus\":\"closed\"}",
        traceId: "trace-1",
        createdAt: "2026-04-16T09:59:00.000Z",
      },
      {
        id: "event-dispatch",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "dispatch:decision_recorded",
        eventTier: "tier_2",
        payloadJson: "{\"ticketId\":\"ticket-1\"}",
        traceId: "trace-1",
        createdAt: "2026-04-16T10:00:00.000Z",
      },
    ],
    dispatchDecisions: [createDispatchDecision()],
    remoteLogs: [
      {
        id: "remote-log-valid",
        taskId: "task-1",
        executionId: "exec-1",
        workerId: "worker-local-1",
        runtimeInstanceId: "runtime-1",
        level: "info",
        message: "remote log ok",
        contextJson: "{\"traceId\":\"trace-1\",\"spanId\":\"span-1\",\"parentSpanId\":\"parent-1\",\"correlationId\":\"corr-1\"}",
        createdAt: "2026-04-16T10:04:00.000Z",
      },
      {
        id: "remote-log-invalid",
        taskId: "task-1",
        executionId: "exec-1",
        workerId: "worker-local-2",
        runtimeInstanceId: null,
        level: "warn",
        message: "bad context",
        contextJson: "{bad json",
        createdAt: "2026-04-16T10:05:00.000Z",
      },
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  assert.equal(timeline.taskId, "task-1");
  assert.deepEqual(
    timeline.entries.map((entry) => entry.kind),
    ["event", "dispatch", "step_output", "approval", "artifact", "remote_log", "remote_log"],
  );

  const dispatchEntry = timeline.entries.find((entry) => entry.kind === "dispatch");
  assert.ok(dispatchEntry);
  assert.equal(dispatchEntry.occurredAt, "2026-04-16T10:00:00.000Z");
  assert.match(dispatchEntry.summary, /fell back to worker-local-1 \(local\)/);
  assert.deepEqual(
    (dispatchEntry.data.remoteAcceptedWorkerIds as string[] | undefined) ?? [],
    ["worker-remote-1"],
  );

  const workerEvent = timeline.entries.find((entry) => entry.id === "event-worker");
  assert.ok(workerEvent);
  assert.match(workerEvent.summary, /session=closed/);

  const invalidRemoteLog = timeline.entries.find((entry) => entry.id === "remote-log-invalid");
  assert.ok(invalidRemoteLog);
  assert.equal(invalidRemoteLog.correlationId, "task-1");
  assert.equal(invalidRemoteLog.traceId, null);
});

test("TaskTimelineService uses the fallback timestamp when no dispatch decision event can be matched", () => {
  const inspectService = createInspectServiceMock({
    recentEvents: [
      {
        id: "event-dispatch-invalid",
        taskId: "task-2",
        sessionId: null,
        executionId: "exec-2",
        eventType: "dispatch:decision_recorded",
        eventTier: "tier_2",
        payloadJson: "{\"ticketId\":123}",
        traceId: "trace-2",
        createdAt: "2026-04-16T11:00:00.000Z",
      },
    ],
    dispatchDecisions: [
      createDispatchDecision({
        ticketId: "ticket-missing",
        taskId: "task-2",
        executionId: "exec-2",
        outcome: "blocked",
        reasonCode: "require_remote_unavailable",
        selectedWorkerId: null,
        selectedWorkerPlacement: null,
        fallbackApplied: false,
        remoteAcceptedWorkerIds: [],
        localAcceptedWorkerIds: [],
      }),
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-2");

  const dispatchEntry = timeline.entries.find((entry) => entry.kind === "dispatch");
  assert.ok(dispatchEntry);
  assert.equal(dispatchEntry.occurredAt, "9999-12-31T23:59:59.999Z");
  assert.match(dispatchEntry.summary, /blocked by require_remote_unavailable/);

  const eventEntries = timeline.entries.filter((entry) => entry.kind === "event");
  assert.equal(eventEntries.length, 0);
});

test("TaskTimelineService handles empty inspect view", () => {
  const emptyInspectService: InspectService = {
    getTaskInspectView() {
      return {
        task: null,
        workflowState: null,
        execution: null,
        session: null,
        approvals: [],
        takeoverSessions: [],
        operatorActions: [],
        agentExecutions: [],
        dispatchDecisions: [],
        remoteRoutingSummary: {},
        leaseHandoverSummary: {},
        recentEvents: [],
        stepOutputs: [],
        stepResults: [],
        taskResult: null,
        artifacts: [],
        runtimeRecovery: {},
        recoverySummary: {
          activeExecutionId: null,
          hasTerminalTask: false,
          lastTakeoverActionType: null,
        },
      } as never;
    },
    listRemoteLogsByTask() {
      return [];
    },
  } as unknown as InspectService;

  const service = new TaskTimelineService(emptyInspectService);
  const timeline = service.buildTaskTimeline("task-empty");

  assert.equal(timeline.taskId, "task-empty");
  assert.equal(timeline.entries.length, 0);
});
