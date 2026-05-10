import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import { DiagnosticsService } from "../../../../../src/platform/shared/observability/diagnostics-service.js";
import { DiagnosticsExportService } from "../../../../../src/platform/shared/observability/diagnostics-export-service.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { ObservabilityRetentionService } from "../../../../../src/platform/shared/observability/observability-retention-service.js";
import { ProviderHealthTracker } from "../../../../../src/platform/shared/observability/provider-health-tracker.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { TaskTimelineService } from "../../../../../src/platform/shared/observability/task-timeline-service.js";
import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../../../src/platform/execution/lease/execution-lease-service.js";
import { ExecutionWorkerHandshakeService } from "../../../../../src/platform/execution/worker-pool/execution-worker-handshake-service.js";
import { runSingleTaskExecution } from "../../../../../src/platform/execution/execution-engine/single-task-execution.js";
import { WorkerRegistryService } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("timeline and diagnostics expose approvals, events, logs, and health in one view", async () => {
  const workspace = createTempWorkspace("aa-timeline-");
  const dbPath = join(workspace, "timeline.db");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Timeline task",
      request: "Produce a timeline and diagnostics snapshot.",
    });

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const inspectService = new InspectService(store);
    const timelineService = new TaskTimelineService(inspectService);
    const providerTracker = new ProviderHealthTracker();
    providerTracker.recordAttempt({
      provider: "mock-primary",
      model: "demo-model",
      succeeded: false,
      latencyMs: 320,
      errorCode: "provider.timeout",
      fallbackProvider: "mock-fallback",
      recordedAt: new Date().toISOString(),
    });
    const healthService = new HealthService(db, store, {
      providerTracker,
      eventLoopLagSampler: () => 275,
    });
    const logger = new StructuredLogger();
    const diagnostics = new DiagnosticsService(
      inspectService,
      healthService,
      logger,
      new ObservabilityRetentionService(db),
    );
    const exportService = new DiagnosticsExportService(diagnostics, store, {
      rootDir: join(workspace, "artifacts"),
    });
    const approvalService = new ApprovalService(db, store);

    logger.log({
      level: "info",
      message: "task timeline prepared",
      taskId: snapshot.task.id,
      ...(snapshot.execution?.traceId ? { traceId: snapshot.execution.traceId } : {}),
    });

    const approval = approvalService.createRequest({
      taskId: snapshot.task.id,
      executionId: snapshot.execution?.id ?? null,
      sourceAgentId: "agent_general_executor",
      reason: "Need operator confirmation",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { reasonCode: "timeline.demo" },
      timeoutPolicy: "reject",
    });

    const timeline = timelineService.buildTaskTimeline(snapshot.task.id);
    const diagnosticSnapshot = diagnostics.buildTaskSnapshot(snapshot.task.id);
    const debugDump = diagnostics.buildDebugDump(snapshot.task.id);
    const reproBundle = diagnostics.buildMinimalReproBundle(snapshot.task.id);
    const exported = exportService.exportMinimalReproBundle(snapshot.task.id);

    assert.equal(timeline.inspect.approvals.length, 1);
    assert.equal(timeline.inspect.approvals[0]?.id, approval.approvalId);
    assert.ok(timeline.entries.some((entry) => entry.kind === "approval"));
    assert.ok(timeline.entries.some((entry) => entry.kind === "event"));
    assert.ok(timeline.entries.some((entry) => entry.kind === "step_output"));
    assert.ok(timeline.entries.some((entry) => entry.kind === "artifact"));
    assert.equal(diagnosticSnapshot.recentLogs.length, 1);
    assert.equal(diagnosticSnapshot.timeline.length, timeline.entries.length);
    assert.equal(diagnosticSnapshot.traceSummary.traceId, snapshot.execution?.traceId ?? null);
    assert.equal(diagnosticSnapshot.traceSummary.correlationId, snapshot.task.id);
    assert.equal(diagnosticSnapshot.traceSummary.spanIds.length >= 1, true);
    assert.equal(diagnosticSnapshot.health.dbWritable, true);
    assert.equal(diagnosticSnapshot.health.providerHealth, "failed");
    assert.equal(diagnosticSnapshot.health.degradationMode, "fast_only");
    assert.equal(diagnosticSnapshot.inspect.taskResult?.status, "success");
    assert.equal(diagnosticSnapshot.inspect.stepResults.length >= 1, true);
    assert.equal(diagnosticSnapshot.contextSummary.compactionCount, 0);
    assert.equal(diagnosticSnapshot.retention?.events.tier_1.retentionDays, null);
    assert.equal(diagnosticSnapshot.retention?.messages.preservedMessageTypes.includes("summary"), true);
    assert.equal(debugDump.taskId, snapshot.task.id);
    assert.equal(debugDump.traceId, snapshot.execution?.traceId ?? null);
    assert.equal(debugDump.traceContext?.correlationId, snapshot.task.id);
    assert.equal(typeof debugDump.traceContext?.spanId, "string");
    assert.ok(debugDump.eventTail.length >= 3);
    assert.ok(debugDump.warnings.includes("approval_pending"));
    assert.ok(debugDump.warnings.includes("provider:failed"));
    assert.equal(debugDump.warningSummary.highestSeverity, "critical");
    assert.ok(debugDump.warningSummary.escalationTargets.includes("operator"));
    assert.equal(
      debugDump.warningSummary.entries.some(
        (entry) => entry.code === "approval_pending" && entry.category === "approval" && entry.count === 1,
      ),
      true,
    );
    assert.equal(
      debugDump.warningSummary.entries.some(
        (entry) => entry.code === "provider:failed" && entry.category === "provider" && entry.severity === "critical",
      ),
      true,
    );
    assert.equal(debugDump.backpressure.degradationMode, "fast_only");
    assert.ok(debugDump.backpressure.healthFindings.includes("provider_failed"));
    assert.equal(debugDump.backpressure.queueGovernance.backlogSize, 0);
    assert.equal(debugDump.backpressure.workerHealth.totalWorkers >= 0, true);
    assert.equal(debugDump.logBuffer.entryCount, 1);
    assert.equal(debugDump.logBuffer.retentionLimit, 500);
    assert.equal(debugDump.retention?.messages.retentionDays, 30);
    assert.equal(reproBundle.taskInputJson, snapshot.task.inputJson);
    assert.equal(reproBundle.taskResult?.status, "success");
    assert.equal(reproBundle.toolUsage.length >= 1, true);
    assert.equal(reproBundle.toolUsage[0]?.result.status, "success");
    assert.equal(reproBundle.sanitizedArtifacts.length, 1);
    assert.match(reproBundle.sensitivityWarning, /may contain/i);
    assert.equal(reproBundle.providerStatus.health, "failed");
    assert.equal(exported.bundle.taskId, snapshot.task.id);
    assert.equal(exported.artifact.kind, "minimal_repro_bundle");
    assert.equal(store.listArtifactsByTask(snapshot.task.id).length >= 2, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("incident timeline report assembles messages, logs, compactions, and exports markdown/json artifacts", async () => {
  const workspace = createTempWorkspace("aa-incident-timeline-");
  const dbPath = join(workspace, "incident-timeline.db");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Incident timeline task",
      request: "Build an incident timeline report.",
    });
    assert.ok(snapshot.session);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const inspectService = new InspectService(store);
    const logger = new StructuredLogger();
    const diagnostics = new DiagnosticsService(inspectService, new HealthService(db, store), logger);
    const exportService = new DiagnosticsExportService(diagnostics, store, {
      rootDir: join(workspace, "artifacts"),
    });
    const approvalService = new ApprovalService(db, store);

    logger.log({
      level: "error",
      message: "remote lease heartbeat stalled during retry",
      taskId: snapshot.task.id,
      correlationId: snapshot.task.id,
      ...(snapshot.execution?.traceId ? { traceId: snapshot.execution.traceId } : {}),
    });
    store.insertMessage({
      id: "msg-incident-tool-result",
      sessionId: snapshot.session.id,
      direction: "system",
      messageType: "tool_result",
      content: "tool retry failed because the remote lease could not be renewed",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-04-06T10:10:03.000Z",
    });
    store.insertCompactionRecord({
      id: "comp-incident-summary",
      sessionId: snapshot.session.id,
      taskId: snapshot.task.id,
      harnessRunId: null,
      nodeRunId: null,
      stage: "summarize",
      sourceMessageIdsJson: JSON.stringify(["msg-incident-tool-result"]),
      summaryText: "Summarized prior tool retries and remote lease mismatch evidence.",
      summaryRef: null,
      compactionReason: "incident.timeline_test",
      overflowTriggered: 0,
      autoTriggered: 1,
      tokenReductionEstimate: 180,
      createdAt: "2026-04-06T10:10:04.000Z",
    });
    approvalService.createRequest({
      taskId: snapshot.task.id,
      executionId: snapshot.execution?.id ?? null,
      sourceAgentId: "agent_general_executor",
      reason: "Need incident review approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { reasonCode: "incident.timeline_test" },
      timeoutPolicy: "reject",
    });

    const report = diagnostics.buildIncidentTimelineReport(snapshot.task.id);
    const exported = exportService.exportIncidentTimeline(snapshot.task.id);

    assert.equal(report.taskId, snapshot.task.id);
    assert.equal(report.summary.stepOutputCount >= 1, true);
    assert.equal(report.summary.logCount, 1);
    assert.equal(report.summary.messageCount >= 1, true);
    assert.equal(report.summary.compactionCount, 1);
    assert.equal(report.summary.approvalCount, 1);
    assert.equal(report.summary.highestSeverity, "critical");
    assert.ok(report.candidateRootCauses.includes("Execution is waiting on an operator approval before it can continue."));
    assert.ok(report.entries.some((entry) => entry.source === "log" && entry.severity === "critical"));
    assert.ok(report.entries.some((entry) => entry.source === "message" && entry.title === "message:tool_result"));
    assert.ok(report.entries.some((entry) => entry.source === "compaction" && entry.title === "compaction:summarize"));
    assert.equal(exported.report.taskId, snapshot.task.id);
    assert.equal(exported.jsonArtifact.kind, "incident_timeline_report");
    assert.equal(exported.markdownArtifact.kind, "incident_timeline_markdown");
    assert.equal(existsSync(exported.jsonArtifact.uri), true);
    assert.equal(existsSync(exported.markdownArtifact.uri), true);
    assert.match(readFileSync(exported.markdownArtifact.uri, "utf8"), /# Incident Timeline:/);
    assert.match(readFileSync(exported.markdownArtifact.uri, "utf8"), /remote lease heartbeat stalled during retry/i);
    assert.equal(store.listArtifactsByTask(snapshot.task.id).length >= 3, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("timeline and diagnostics aggregate persisted remote worker logs into remote timeline views", () => {
  const workspace = createTempWorkspace("aa-remote-timeline-");
  const dbPath = join(workspace, "remote-timeline.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspectService = new InspectService(store);
    const timelineService = new TaskTimelineService(inspectService);
    const diagnostics = new DiagnosticsService(inspectService, new HealthService(db, store), new StructuredLogger());
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const handshake = new ExecutionWorkerHandshakeService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-remote-timeline",
      executionId: "exec-remote-timeline",
      traceId: "trace-remote-timeline",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-remote-timeline");
    workers.recordHeartbeat({
      workerId: "worker-remote-timeline",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T12:59:59.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:200",
      sessionConsistencyCheckStatus: "passed",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-remote-timeline-1",
      occurredAt: "2026-04-06T13:00:00.000Z",
    });
    const created = dispatch.createTicket({
      executionId: "exec-remote-timeline",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-06T13:00:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-06T13:00:06.000Z",
    });
    handshake.claimExecution({
      ticketId: created.ticket.id,
      workerId: "worker-remote-timeline",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      runtimeInstanceId: "runtime-remote-timeline-1",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:201",
      sessionConsistencyCheckStatus: "passed",
      remoteLogs: [
        {
          level: "info",
          message: "remote sandbox prepared the working tree",
          context: { stage: "claim" },
        },
      ],
      occurredAt: "2026-04-06T13:00:07.000Z",
    });
    handshake.recordHeartbeat({
      executionId: "exec-remote-timeline",
      workerId: "worker-remote-timeline",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      ttlMs: 30_000,
      runtimeInstanceId: "runtime-remote-timeline-2",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:202",
      sessionConsistencyCheckStatus: "passed",
      remoteLogs: [
        {
          level: "warn",
          message: "remote checkout drift detected while replaying logs",
          context: { stage: "heartbeat", lagMs: 1200 },
        },
      ],
      occurredAt: "2026-04-06T13:00:10.000Z",
    });

    const timeline = timelineService.buildTaskTimeline("task-remote-timeline");
    const incident = diagnostics.buildIncidentTimelineReport("task-remote-timeline");
    const remoteTimeline = diagnostics.buildRemoteTimelineReport("task-remote-timeline");

    assert.equal(timeline.entries.some((entry) => entry.kind === "remote_log"), true);
    assert.equal(incident.summary.remoteLogCount, 2);
    assert.equal(remoteTimeline.totalRemoteLogs, 2);
    assert.deepEqual(remoteTimeline.remoteWorkerIds, ["worker-remote-timeline"]);
    assert.equal(remoteTimeline.entries.some((entry) => entry.source === "dispatch"), true);
    assert.equal(
      remoteTimeline.entries.some(
        (entry) => entry.source === "remote_log" && entry.summary.toLowerCase().includes("checkout drift detected"),
      ),
      true,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("diagnostics surfaces dispatch summaries and repro bundle dispatch decisions", () => {
  const workspace = createTempWorkspace("aa-diagnostics-dispatch-");
  const dbPath = join(workspace, "dispatch-diagnostics.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspectService = new InspectService(store);
    const healthService = new HealthService(db, store);
    const diagnostics = new DiagnosticsService(inspectService, healthService, new StructuredLogger());
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-diagnostics-dispatch",
      executionId: "exec-diagnostics-dispatch",
      traceId: "trace-diagnostics-dispatch",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-diagnostics-dispatch");
    workers.recordHeartbeat({
      workerId: "worker-diagnostics-capable",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T16:20:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-diagnostics-basic",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T16:20:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-diagnostics-dispatch",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-04T16:20:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T16:20:06.000Z",
    });

    const snapshot = diagnostics.buildTaskSnapshot("task-diagnostics-dispatch");
    const debugDump = diagnostics.buildDebugDump("task-diagnostics-dispatch");
    const reproBundle = diagnostics.buildMinimalReproBundle("task-diagnostics-dispatch");

    assert.equal(snapshot.inspect.dispatchDecisions.length, 1);
    assert.equal(snapshot.contextSummary.dispatchDecisionCount, 1);
    assert.equal(snapshot.contextSummary.latestDispatchOutcome, "dispatched");
    assert.equal(snapshot.traceSummary.traceId, "trace-diagnostics-dispatch");
    assert.equal(snapshot.contextSummary.remoteRouting.totalDecisions, 1);
    assert.equal(snapshot.contextSummary.remoteRouting.remoteDecisionCount, 0);
    assert.equal(snapshot.contextSummary.remoteRouting.healthyDecisionCount, 0);
    assert.equal(snapshot.contextSummary.remoteRouting.partialAvailableDecisionCount, 0);
    assert.equal(snapshot.contextSummary.remoteRouting.degradedDecisionCount, 0);
    assert.equal(snapshot.contextSummary.remoteRouting.unavailableDecisionCount, 0);
    assert.equal(debugDump.dispatchSummary.totalDecisions, 1);
    assert.equal(debugDump.dispatchSummary.latestSelectedWorkerId, "worker-diagnostics-capable");
    assert.equal(debugDump.traceContext?.traceId, "trace-diagnostics-dispatch");
    assert.equal(debugDump.dispatchSummary.latestSelectedWorkerPlacement, "local");
    assert.equal(debugDump.dispatchSummary.latestRemoteAvailability, null);
    assert.equal(debugDump.dispatchSummary.latestFallbackApplied, false);
    assert.ok(debugDump.dispatchSummary.latestRejectedWorkers.includes("worker-diagnostics-basic"));
    assert.deepEqual(debugDump.dispatchSummary.latestRemoteRejectedWorkers, []);
    assert.deepEqual(debugDump.dispatchSummary.latestRemoteAcceptedWorkers, []);
    assert.equal(debugDump.backpressure.queueGovernance.backlogSize, 1);
    assert.equal(debugDump.backpressure.queueGovernance.claimedBacklogSize, 1);
    assert.ok(debugDump.backpressure.healthFindings.includes("queue_starvation_detected"));
    assert.equal(reproBundle.taskResult, null);
    assert.equal(reproBundle.dispatchDecisions.length, 1);
    assert.equal(reproBundle.dispatchDecisions[0]?.selectedWorkerId, "worker-diagnostics-capable");
    assert.equal(reproBundle.toolUsage.length, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("timeline and diagnostics surface remote fallback dispatches as first-class routing events", () => {
  const workspace = createTempWorkspace("aa-timeline-remote-fallback-");
  const dbPath = join(workspace, "timeline-remote-fallback.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspectService = new InspectService(store);
    const timelineService = new TaskTimelineService(inspectService);
    const healthService = new HealthService(db, store);
    const diagnostics = new DiagnosticsService(inspectService, healthService, new StructuredLogger());
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-timeline-remote-fallback",
      executionId: "exec-timeline-remote-fallback",
      traceId: "trace-timeline-remote-fallback",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-timeline-remote-fallback");
    workers.recordHeartbeat({
      workerId: "worker-timeline-remote-offline",
      status: "offline",
      placement: "remote",
      registrationVerifiedAt: "2026-04-05T08:59:59.000Z",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-05T09:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-timeline-local-fallback",
      status: "idle",
      placement: "local",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-05T09:00:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-timeline-remote-fallback",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-05T09:00:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-05T09:00:06.000Z",
    });

    const timeline = timelineService.buildTaskTimeline("task-timeline-remote-fallback");
    const snapshot = diagnostics.buildTaskSnapshot("task-timeline-remote-fallback");
    const debugDump = diagnostics.buildDebugDump("task-timeline-remote-fallback");

    const dispatchEntry = timeline.entries.find((entry) => entry.kind === "dispatch");
    assert.ok(dispatchEntry);
    assert.match(dispatchEntry?.summary ?? "", /fell back to worker-timeline-local-fallback \(local\)/i);
    assert.equal(dispatchEntry?.data.selectedWorkerPlacement, "local");
    assert.equal(dispatchEntry?.data.remoteAvailability, "unavailable");
    assert.ok(
      timeline.entries.some(
        (entry) => entry.kind === "event" && entry.traceId === "trace-timeline-remote-fallback" && entry.correlationId != null,
      ),
    );
    assert.equal(snapshot.traceSummary.correlationId, "task-timeline-remote-fallback");
    assert.equal(snapshot.contextSummary.remoteRouting.remoteDecisionCount, 1);
    assert.equal(snapshot.contextSummary.remoteRouting.partialAvailableDecisionCount, 0);
    assert.equal(snapshot.contextSummary.remoteRouting.degradedDecisionCount, 0);
    assert.equal(snapshot.contextSummary.remoteRouting.unavailableDecisionCount, 1);
    assert.equal(snapshot.contextSummary.remoteRouting.localFallbackCount, 1);
    assert.equal(snapshot.contextSummary.remoteRouting.latestSelectedWorkerPlacement, "local");
    assert.deepEqual(snapshot.contextSummary.remoteRouting.remoteWorkerIds, ["worker-timeline-remote-offline"]);
    assert.equal(debugDump.dispatchSummary.latestSelectedWorkerPlacement, "local");
    assert.equal(debugDump.dispatchSummary.latestRemoteAvailability, "unavailable");
    assert.equal(debugDump.dispatchSummary.latestFallbackApplied, true);
    assert.deepEqual(debugDump.dispatchSummary.latestRemoteRejectedWorkers, ["worker-timeline-remote-offline"]);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("timeline and diagnostics surface partial_available remote routing as an explicit blocked state", () => {
  const workspace = createTempWorkspace("aa-timeline-remote-partial-");
  const dbPath = join(workspace, "timeline-remote-partial.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspectService = new InspectService(store);
    const timelineService = new TaskTimelineService(inspectService);
    const healthService = new HealthService(db, store);
    const diagnostics = new DiagnosticsService(inspectService, healthService, new StructuredLogger());
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-timeline-remote-partial",
      executionId: "exec-timeline-remote-partial",
      traceId: "trace-timeline-remote-partial",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-timeline-remote-partial");
    workers.recordHeartbeat({
      workerId: "worker-timeline-remote-partial-busy",
      status: "busy",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T13:19:59.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:111",
      capabilities: ["bash", "edit"],
      runningExecutionIds: ["exec-other"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T13:20:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-timeline-remote-partial-missing",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T13:19:59.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:112",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T13:20:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-timeline-remote-partial",
      queueName: "default",
      dispatchTarget: "require_remote",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-06T13:20:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-06T13:20:06.000Z",
    });

    const timeline = timelineService.buildTaskTimeline("task-timeline-remote-partial");
    const snapshot = diagnostics.buildTaskSnapshot("task-timeline-remote-partial");
    const debugDump = diagnostics.buildDebugDump("task-timeline-remote-partial");

    assert.equal(snapshot.inspect.dispatchDecisions[0]?.remoteAvailability, "partial_available");
    assert.equal(snapshot.inspect.dispatchDecisions[0]?.reasonCode, "remote.partial_available");
    assert.equal(snapshot.contextSummary.remoteRouting.partialAvailableDecisionCount, 1);
    assert.equal(debugDump.dispatchSummary.latestRemoteAvailability, "partial_available");
    assert.ok(debugDump.warnings.includes("dispatch:blocked"));
    assert.equal(
      debugDump.warningSummary.entries.some(
        (entry) => entry.code === "dispatch:blocked" && entry.category === "dispatch" && entry.severity === "warning",
      ),
      true,
    );
    assert.ok(
      timeline.entries.some(
        (entry) =>
          entry.kind === "dispatch"
          && entry.data.remoteAvailability === "partial_available"
          && entry.summary.toLowerCase().includes("partial_available"),
      ),
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("timeline and diagnostics summarize lease handovers in inspect and debug views", () => {
  const workspace = createTempWorkspace("aa-timeline-handover-");
  const dbPath = join(workspace, "timeline-handover.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspectService = new InspectService(store);
    const timelineService = new TaskTimelineService(inspectService);
    const healthService = new HealthService(db, store);
    const diagnostics = new DiagnosticsService(inspectService, healthService, new StructuredLogger());
    const workers = new WorkerRegistryService(store);
    const leases = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-timeline-handover",
      executionId: "exec-timeline-handover",
      traceId: "trace-timeline-handover",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("running", "exec-timeline-handover");
    workers.recordHeartbeat({
      workerId: "worker-timeline-handover-a",
      status: "draining",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-timeline-handover"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T12:10:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-timeline-handover-b",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T12:10:00.000Z",
    });

    const granted = leases.acquireLease({
      executionId: "exec-timeline-handover",
      workerId: "worker-timeline-handover-a",
      ttlMs: 30_000,
      occurredAt: "2026-04-06T12:10:00.000Z",
    });
    const handover = leases.handoverLease({
      leaseId: granted.lease?.id ?? "",
      workerId: "worker-timeline-handover-a",
      newWorkerId: "worker-timeline-handover-b",
      ttlMs: 30_000,
      reasonCode: "timeline.handover",
      occurredAt: "2026-04-06T12:10:10.000Z",
    });

    const timeline = timelineService.buildTaskTimeline("task-timeline-handover");
    const snapshot = diagnostics.buildTaskSnapshot("task-timeline-handover");
    const debugDump = diagnostics.buildDebugDump("task-timeline-handover");

    assert.equal(handover.outcome, "handed_over");
    assert.equal(snapshot.inspect.leaseHandoverSummary.totalHandovers, 1);
    assert.equal(snapshot.inspect.leaseHandoverSummary.latestReasonCode, "timeline.handover");
    assert.equal(snapshot.contextSummary.leaseHandover.totalHandovers, 1);
    assert.equal(snapshot.contextSummary.leaseHandover.latestPreviousWorkerId, "worker-timeline-handover-a");
    assert.equal(snapshot.contextSummary.leaseHandover.latestWorkerId, "worker-timeline-handover-b");
    assert.equal(debugDump.leaseSummary.totalHandovers, 1);
    assert.equal(debugDump.leaseSummary.latestReasonCode, "timeline.handover");
    assert.deepEqual(debugDump.leaseSummary.workerIds, ["worker-timeline-handover-a", "worker-timeline-handover-b"]);
    assert.ok(
      timeline.entries.some(
        (entry) =>
          entry.kind === "event"
          && entry.title === "lease:handover_recorded"
          && entry.traceId === "trace-timeline-handover",
      ),
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("timeline and diagnostics surface remote authority rejection reasons from worker runtime events", () => {
  const workspace = createTempWorkspace("aa-timeline-remote-authority-");
  const dbPath = join(workspace, "timeline-remote-authority.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspectService = new InspectService(store);
    const timelineService = new TaskTimelineService(inspectService);
    const healthService = new HealthService(db, store);
    const diagnostics = new DiagnosticsService(inspectService, healthService, new StructuredLogger());
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const handshake = new ExecutionWorkerHandshakeService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-timeline-remote-authority",
      executionId: "exec-timeline-remote-authority",
      traceId: "trace-timeline-remote-authority",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-timeline-remote-authority");
    workers.recordHeartbeat({
      workerId: "worker-timeline-remote-authority",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-05T09:19:59.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:900",
      sessionConsistencyCheckStatus: "passed",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-timeline-remote-authority-1",
      occurredAt: "2026-04-05T09:20:00.000Z",
    });
    const created = dispatch.createTicket({
      executionId: "exec-timeline-remote-authority",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-05T09:20:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-05T09:20:06.000Z",
    });
    handshake.claimExecution({
      ticketId: created.ticket.id,
      workerId: "worker-timeline-remote-authority",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      runtimeInstanceId: "runtime-timeline-remote-authority-1",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:901",
      sessionConsistencyCheckStatus: "passed",
      occurredAt: "2026-04-05T09:20:07.000Z",
    });
    handshake.recordHeartbeat({
      executionId: "exec-timeline-remote-authority",
      workerId: "worker-timeline-remote-authority",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      ttlMs: 30_000,
      runtimeInstanceId: "runtime-timeline-remote-authority-1",
      remoteSessionStatus: "reconnecting",
      lastAcknowledgedStreamOffset: "",
      sessionConsistencyCheckStatus: "passed",
      occurredAt: "2026-04-05T09:20:08.000Z",
    });
    handshake.recordHeartbeat({
      executionId: "exec-timeline-remote-authority",
      workerId: "worker-timeline-remote-authority",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      ttlMs: 30_000,
      runtimeInstanceId: "runtime-timeline-remote-authority-1",
      remoteSessionStatus: "reconnecting",
      lastAcknowledgedStreamOffset: "",
      sessionConsistencyCheckStatus: "passed",
      occurredAt: "2026-04-05T09:20:09.000Z",
    });

    const timeline = timelineService.buildTaskTimeline("task-timeline-remote-authority");
    const snapshot = diagnostics.buildTaskSnapshot("task-timeline-remote-authority");
    const debugDump = diagnostics.buildDebugDump("task-timeline-remote-authority");

    const rejectionEntry = timeline.entries.find(
      (entry) => entry.kind === "event" && entry.title === "worker:heartbeat_rejected",
    );
    assert.ok(rejectionEntry);
    assert.match(rejectionEntry?.summary ?? "", /remote_session_resume_offset_missing/i);
    assert.match(rejectionEntry?.summary ?? "", /session=reconnecting/i);
    assert.equal(snapshot.contextSummary.remoteAuthorityViolationCount, 2);
    assert.equal(snapshot.contextSummary.latestRemoteAuthorityReason, "remote_session_resume_offset_missing");
    assert.ok(debugDump.warnings.includes("remote_authority:remote_session_resume_offset_missing"));
    assert.equal(
      debugDump.warnings.filter((warning) => warning === "remote_authority:remote_session_resume_offset_missing").length,
      1,
    );
    assert.equal(debugDump.warningSummary.suppressedDuplicateCount, 1);
    assert.equal(
      debugDump.warningSummary.entries.some(
        (entry) =>
          entry.code === "remote_authority:remote_session_resume_offset_missing"
          && entry.category === "remote_authority"
          && entry.count === 2
          && entry.suppressedCount === 1
          && entry.escalation === "operator",
      ),
      true,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
