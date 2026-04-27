import assert from "node:assert/strict";
import test from "node:test";

import { TaskTimelineService } from "../../../../../src/platform/shared/observability/task-timeline-service.js";
import type { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";

function createInspectServiceMockWithEvents(options: {
  recentEvents: Array<Record<string, unknown>>;
  dispatchDecisions?: Array<Record<string, unknown>>;
  stepOutputs?: Array<Record<string, unknown>>;
  approvals?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
  remoteLogs?: Array<Record<string, unknown>>;
}): InspectService {
  return {
    getTaskInspectView() {
      return {
        task: { id: "task-1", status: "in_progress" },
        workflowState: null,
        execution: { id: "exec-1", traceId: "trace-1" },
        session: null,
        approvals: options.approvals ?? [],
        takeoverSessions: [],
        operatorActions: [],
        agentExecutions: [],
        dispatchDecisions: options.dispatchDecisions ?? [],
        remoteRoutingSummary: {},
        leaseHandoverSummary: {},
        recentEvents: options.recentEvents,
        stepOutputs: options.stepOutputs ?? [],
        stepResults: [],
        taskResult: null,
        artifacts: options.artifacts ?? [],
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

function createRemoteLogRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "remote-log-1",
    taskId: "task-1",
    executionId: "exec-1",
    workerId: "worker-1",
    runtimeInstanceId: "runtime-1",
    level: "info",
    message: "remote log message",
    contextJson: null,
    createdAt: "2026-04-26T10:00:00.000Z",
    ...overrides,
  };
}

test("TaskTimelineService handles null contextJson in remote logs", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [],
    remoteLogs: [createRemoteLogRecord({ contextJson: null })],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  const remoteLogEntry = timeline.entries.find((e) => e.kind === "remote_log");
  assert.ok(remoteLogEntry !== undefined);
  assert.equal(remoteLogEntry!.correlationId, "task-1"); // Falls back to taskId
});

test("TaskTimelineService handles invalid JSON in contextJson", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [],
    remoteLogs: [createRemoteLogRecord({ contextJson: "{invalid json" })],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  const remoteLogEntry = timeline.entries.find((e) => e.kind === "remote_log");
  assert.ok(remoteLogEntry !== undefined);
  assert.equal(remoteLogEntry!.correlationId, "task-1");
});

test("TaskTimelineService handles missing workerId in remote logs", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [],
    remoteLogs: [
      createRemoteLogRecord({
        workerId: null as any,
        runtimeInstanceId: null,
        message: "log without worker",
      }),
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  const remoteLogEntry = timeline.entries.find((e) => e.kind === "remote_log");
  assert.ok(remoteLogEntry !== undefined);
  assert.ok(remoteLogEntry!.summary.includes("null"));
});

test("TaskTimelineService handles various event types correctly", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [
      {
        id: "event-task-status",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "task:status_changed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ from: "queued", to: "in_progress" }),
        traceId: "trace-1",
        createdAt: "2026-04-26T09:00:00.000Z",
      },
      {
        id: "event-worker-heartbeat",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "worker:heartbeat",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({}),
        traceId: "trace-1",
        createdAt: "2026-04-26T09:01:00.000Z",
      },
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  assert.equal(timeline.entries.length, 2);
  assert.ok(timeline.entries.every((e) => e.kind === "event"));
});

test("TaskTimelineService handles worker rejection events correctly", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [
      {
        id: "event-claim-rejected",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "worker:claim_rejected",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({ reasonCode: "worker_offline" }),
        traceId: "trace-1",
        createdAt: "2026-04-26T09:00:00.000Z",
      },
      {
        id: "event-writeback-rejected",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "worker:writeback_rejected",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({ reasonCode: "session_closed", remoteSessionStatus: "closed" }),
        traceId: "trace-1",
        createdAt: "2026-04-26T09:01:00.000Z",
      },
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  const claimRejected = timeline.entries.find((e) => e.id === "event-claim-rejected");
  assert.ok(claimRejected?.summary.includes("worker_offline"));

  const writebackRejected = timeline.entries.find((e) => e.id === "event-writeback-rejected");
  assert.ok(writebackRejected?.summary.includes("session=closed"));
});

test("TaskTimelineService handles multiple dispatch decisions", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [
      {
        id: "event-dispatch-1",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "dispatch:decision_recorded",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({ ticketId: "ticket-1" }),
        traceId: "trace-1",
        createdAt: "2026-04-26T09:00:00.000Z",
      },
      {
        id: "event-dispatch-2",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "dispatch:decision_recorded",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({ ticketId: "ticket-2" }),
        traceId: "trace-1",
        createdAt: "2026-04-26T09:05:00.000Z",
      },
    ],
    dispatchDecisions: [
      {
        ticketId: "ticket-1",
        executionId: "exec-1",
        taskId: "task-1",
        queueName: "default",
        dispatchTarget: "prefer_remote",
        remoteAvailability: "healthy",
        requiredCapabilities: [],
        outcome: "dispatched",
        reasonCode: null,
        selectedWorkerId: "worker-1",
        leaseId: "lease-1",
        fallbackApplied: false,
        selectedWorkerPlacement: "remote",
        acceptedWorkerIds: ["worker-1"],
        rejectedWorkerIds: [],
        remoteAcceptedWorkerIds: ["worker-1"],
        remoteRejectedWorkerIds: [],
        localAcceptedWorkerIds: [],
        localRejectedWorkerIds: [],
      },
      {
        ticketId: "ticket-2",
        executionId: "exec-1",
        taskId: "task-1",
        queueName: "default",
        dispatchTarget: "prefer_local",
        remoteAvailability: "unavailable",
        requiredCapabilities: [],
        outcome: "dispatched",
        reasonCode: null,
        selectedWorkerId: "worker-local-1",
        leaseId: "lease-2",
        fallbackApplied: true,
        selectedWorkerPlacement: "local",
        acceptedWorkerIds: ["worker-local-1"],
        rejectedWorkerIds: [],
        remoteAcceptedWorkerIds: [],
        remoteRejectedWorkerIds: [],
        localAcceptedWorkerIds: ["worker-local-1"],
        localRejectedWorkerIds: [],
      },
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  const dispatchEntries = timeline.entries.filter((e) => e.kind === "dispatch");
  assert.equal(dispatchEntries.length, 2);
});

test("TaskTimelineService sorts entries by occurredAt chronologically", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [
      {
        id: "event-late",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "task:status_changed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({}),
        traceId: "trace-1",
        createdAt: "2026-04-26T12:00:00.000Z",
      },
      {
        id: "event-early",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "task:status_changed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({}),
        traceId: "trace-1",
        createdAt: "2026-04-26T08:00:00.000Z",
      },
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  assert.equal(timeline.entries[0]!.id, "event-early");
  assert.equal(timeline.entries[1]!.id, "event-late");
});

test("TaskTimelineService excludes dispatch:decision_recorded events from main events list", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [
      {
        id: "event-dispatch",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "dispatch:decision_recorded",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({ ticketId: "ticket-1" }),
        traceId: "trace-1",
        createdAt: "2026-04-26T09:00:00.000Z",
      },
      {
        id: "event-other",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "task:status_changed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({}),
        traceId: "trace-1",
        createdAt: "2026-04-26T09:01:00.000Z",
      },
    ],
    dispatchDecisions: [
      {
        ticketId: "ticket-1",
        executionId: "exec-1",
        taskId: "task-1",
        queueName: "default",
        dispatchTarget: "any",
        remoteAvailability: null,
        requiredCapabilities: [],
        outcome: "dispatched",
        reasonCode: null,
        selectedWorkerId: "worker-1",
        leaseId: "lease-1",
        fallbackApplied: false,
        selectedWorkerPlacement: null,
        acceptedWorkerIds: ["worker-1"],
        rejectedWorkerIds: [],
        remoteAcceptedWorkerIds: [],
        remoteRejectedWorkerIds: [],
        localAcceptedWorkerIds: ["worker-1"],
        localRejectedWorkerIds: [],
      },
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  // Should have 1 dispatch entry and 1 other event
  const dispatchEntries = timeline.entries.filter((e) => e.kind === "dispatch");
  const eventEntries = timeline.entries.filter((e) => e.kind === "event");

  assert.equal(dispatchEntries.length, 1);
  assert.equal(eventEntries.length, 1);
  assert.equal(eventEntries[0]!.id, "event-other");
});

test("TaskTimelineService handles step output entries with various statuses", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [],
    stepOutputs: [
      {
        id: "step-succeeded",
        taskId: "task-1",
        stepId: "execute",
        roleId: "executor",
        status: "succeeded",
        dataJson: JSON.stringify({}),
        summary: "Step completed successfully",
        artifactsJson: null,
        tokenCost: 100,
        durationMs: 500,
        validationJson: null,
        producedAt: "2026-04-26T10:00:00.000Z",
      },
      {
        id: "step-failed",
        taskId: "task-1",
        stepId: "execute",
        roleId: "executor",
        status: "failed",
        dataJson: JSON.stringify({}),
        summary: "Step failed",
        artifactsJson: null,
        tokenCost: 50,
        durationMs: 200,
        validationJson: null,
        producedAt: "2026-04-26T10:05:00.000Z",
      },
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  const stepEntries = timeline.entries.filter((e) => e.kind === "step_output");
  assert.equal(stepEntries.length, 2);
  assert.ok(stepEntries[0]!.summary.includes("completed successfully"));
  assert.ok(stepEntries[1]!.summary.includes("failed"));
});

test("TaskTimelineService handles approval entries with requested status", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [],
    approvals: [
      {
        id: "approval-requested",
        taskId: "task-1",
        executionId: "exec-1",
        status: "requested",
        requestJson: JSON.stringify({}),
        responseJson: null,
        timeoutPolicy: "24h",
        createdAt: "2026-04-26T10:00:00.000Z",
        respondedAt: null,
      },
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  const approvalEntries = timeline.entries.filter((e) => e.kind === "approval");
  assert.equal(approvalEntries.length, 1);
  assert.ok(approvalEntries[0]!.title.includes("requested"));
});

test("TaskTimelineService handles approval entries with responded status", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [],
    approvals: [
      {
        id: "approval-responded",
        taskId: "task-1",
        executionId: "exec-1",
        status: "approved",
        requestJson: JSON.stringify({}),
        responseJson: JSON.stringify({}),
        timeoutPolicy: "24h",
        createdAt: "2026-04-26T10:00:00.000Z",
        respondedAt: "2026-04-26T10:30:00.000Z",
      },
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  const approvalEntries = timeline.entries.filter((e) => e.kind === "approval");
  assert.equal(approvalEntries.length, 1);
  assert.ok(approvalEntries[0]!.title.includes("approved"));
  assert.equal(approvalEntries[0]!.occurredAt, "2026-04-26T10:30:00.000Z"); // Uses respondedAt
});

test("TaskTimelineService handles artifact entries with different kinds", () => {
  const inspectService = createInspectServiceMockWithEvents({
    recentEvents: [],
    artifacts: [
      {
        artifactId: "artifact-1",
        taskId: "task-1",
        executionId: "exec-1",
        stepId: "execute",
        kind: "report",
        storagePath: "/tmp/report.md",
        fileName: "report.md",
        mimeType: "text/markdown",
        sizeBytes: 1024,
        checksum: "abc123",
        lineageJson: "{}",
        createdAt: "2026-04-26T10:00:00.000Z",
      },
      {
        artifactId: "artifact-2",
        taskId: "task-1",
        executionId: "exec-1",
        stepId: null,
        kind: "output",
        storagePath: "/tmp/output.json",
        fileName: "output.json",
        mimeType: "application/json",
        sizeBytes: 512,
        checksum: "def456",
        lineageJson: "{}",
        createdAt: "2026-04-26T10:05:00.000Z",
      },
    ],
  });

  const service = new TaskTimelineService(inspectService);
  const timeline = service.buildTaskTimeline("task-1");

  const artifactEntries = timeline.entries.filter((e) => e.kind === "artifact");
  assert.equal(artifactEntries.length, 2);
  assert.ok(artifactEntries[0]!.title.includes("report"));
  assert.ok(artifactEntries[1]!.title.includes("output"));
});
