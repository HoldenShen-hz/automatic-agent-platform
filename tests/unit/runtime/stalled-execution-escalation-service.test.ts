import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DiagnosticsService } from "../../../src/platform/shared/observability/diagnostics-service.js";
import { HealthService } from "../../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../../src/platform/shared/observability/inspect-service.js";
import { StructuredLogger } from "../../../src/platform/shared/observability/structured-logger.js";
import { StalledExecutionDetector } from "../../../src/platform/execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../../src/platform/execution/recovery/stalled-execution-escalation-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { seedTaskAndExecution } from "../../helpers/seed.js";

test("stalled execution escalation service builds a missing-heartbeat escalation package", () => {
  const workspace = createTempWorkspace("aa-stalled-escalation-");
  const dbPath = join(workspace, "stalled-escalation.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-stalled-escalation",
      executionId: "exec-stalled-escalation",
      traceId: "trace-stalled-escalation",
    });

    db.connection.prepare(`UPDATE executions SET updated_at = ? WHERE id = ?`).run(
      "2026-04-04T10:00:00.000Z",
      "exec-stalled-escalation",
    );
    store.insertWorkflowState({
      taskId: "task-stalled-escalation",
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: "2026-04-04T10:00:00.000Z",
      updatedAt: "2026-04-04T10:00:00.000Z",
    });
    store.upsertAgentExecutionRecord({
      executionId: "exec-stalled-escalation",
      taskId: "task-stalled-escalation",
      agentId: "agent-1",
      workflowId: "single_agent_minimal",
      roleId: "general_executor",
      runKind: "task_run",
      runtimeInstanceId: "runtime-stalled-escalation-1",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      status: "executing",
      planJson: "{}",
      currentStepId: "step-stalled-escalation",
      lastToolName: "bash.exec",
      toolCallCount: 1,
      lastDecisionJson: null,
      lastErrorCode: null,
      retryCount: 0,
      progressMessage: "waiting on heartbeat",
      startedAt: "2026-04-04T10:00:00.000Z",
      createdAt: "2026-04-04T10:00:00.000Z",
      updatedAt: "2026-04-04T10:00:00.000Z",
      completedAt: null,
    });

    const diagnostics = new DiagnosticsService(
      new InspectService(store),
      new HealthService(db, store),
      new StructuredLogger(),
    );
    const service = new StalledExecutionEscalationService(new StalledExecutionDetector(store), diagnostics);

    const packages = service.buildPackages({ now: "2026-04-04T10:10:00.000Z" });

    assert.equal(packages.length, 1);
    assert.equal(packages[0]?.executionId, "exec-stalled-escalation");
    assert.equal(packages[0]?.staleKind, "missing_heartbeat");
    assert.equal(packages[0]?.recommendedAction, "lease_reclaim");
    assert.equal(packages[0]?.suggestedOperatorAction, "reclaim_lease_and_requeue");
    assert.equal(packages[0]?.traceId, "trace-stalled-escalation");
    assert.equal(packages[0]?.correlationId, "task-stalled-escalation");
    assert.equal(packages[0]?.currentStepId, "step-stalled-escalation");
    assert.equal(packages[0]?.runtimeInstanceId, "runtime-stalled-escalation-1");
    assert.equal(packages[0]?.healthStatus, "ok");
    assert.equal(packages[0]?.incident.highestSeverity, "info");
    assert.ok((packages[0]?.warnings.totalEvents ?? 0) >= 1);
    assert.ok((packages[0]?.incident.candidateRootCauses.length ?? 0) >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("stalled execution escalation service recommends restart when heartbeat is still present", () => {
  const workspace = createTempWorkspace("aa-stalled-escalation-heartbeat-");
  const dbPath = join(workspace, "stalled-escalation-heartbeat.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-stalled-heartbeat",
      executionId: "exec-stalled-heartbeat",
      traceId: "trace-stalled-heartbeat",
    });

    db.connection.prepare(`UPDATE executions SET updated_at = ? WHERE id = ?`).run(
      "2026-04-04T10:00:00.000Z",
      "exec-stalled-heartbeat",
    );
    store.insertHeartbeatSnapshot({
      id: "hb-stalled-heartbeat",
      executionId: "exec-stalled-heartbeat",
      agentId: "agent-1",
      runtimeInstanceId: "runtime-stalled-heartbeat-1",
      restartGeneration: 0,
      status: "executing",
      progressMessage: "heartbeat still arriving",
      cpuPct: 20,
      memoryMb: 128,
      sampledAt: "2026-04-04T10:08:30.000Z",
    });

    const diagnostics = new DiagnosticsService(
      new InspectService(store),
      new HealthService(db, store),
      new StructuredLogger(),
    );
    const service = new StalledExecutionEscalationService(new StalledExecutionDetector(store), diagnostics);

    const packages = service.buildPackages({
      now: "2026-04-04T10:10:00.000Z",
      staleAfterMs: 5 * 60 * 1000,
      heartbeatGraceMs: 2 * 60 * 1000,
    });

    assert.equal(packages.length, 1);
    assert.equal(packages[0]?.staleKind, "no_progress");
    assert.equal(packages[0]?.recommendedAction, "restart_or_escalate");
    assert.equal(packages[0]?.suggestedOperatorAction, "restart_execution_or_takeover");
    assert.equal(packages[0]?.lastHeartbeatAt, "2026-04-04T10:08:30.000Z");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
