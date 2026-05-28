import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { DiagnosticsExportService } from "../../../../src/platform/shared/observability/diagnostics-export-service.js";
import { DiagnosticsService } from "../../../../src/platform/shared/observability/diagnostics-service.js";
import { HealthService } from "../../../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../../../src/platform/shared/observability/inspect-service.js";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { StalledExecutionDetector } from "../../../../src/platform/five-plane-execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../../../src/platform/five-plane-execution/recovery/stalled-execution-escalation-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("incident timeline export stays within the configured artifact root and records both artifacts", async () => {
  const workspace = createTempWorkspace("aa-incident-export-security-");
  const dbPath = join(workspace, "incident-export-security.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Incident export security task",
      request: "Verify incident export sandbox boundaries.",
    });

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const diagnostics = new DiagnosticsService(
      new InspectService(store),
      new HealthService(db, store),
      new StructuredLogger(),
    );
    const exportService = new DiagnosticsExportService(diagnostics, store, {
      rootDir: artifactRoot,
    });

    const exported = exportService.exportIncidentTimeline(snapshot.task.id);
    const normalizedRoot = resolve(artifactRoot);

    assert.equal(exported.jsonArtifact.uri.startsWith(normalizedRoot), true);
    assert.equal(exported.markdownArtifact.uri.startsWith(normalizedRoot), true);
    assert.equal(exported.jsonArtifact.uri.includes(".."), false);
    assert.equal(exported.markdownArtifact.uri.includes(".."), false);
    assert.equal(exported.jsonArtifact.uri.endsWith(".json"), true);
    assert.equal(exported.markdownArtifact.uri.endsWith(".md"), true);
    assert.deepEqual(
      store.listArtifactsByTask(snapshot.task.id).slice(-2).map((artifact) => artifact.kind),
      ["incident_timeline_report", "incident_timeline_markdown"],
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("minimal repro export redacts secrets in returned output and persisted artifact payloads", async () => {
  const workspace = createTempWorkspace("aa-repro-export-security-");
  const dbPath = join(workspace, "repro-export-security.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Repro export security task",
      request: "Authorization: Bearer secret-token-1234567890",
    });
    assert.ok(snapshot.session);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    store.insertMessage({
      id: "msg-repro-export-secret",
      sessionId: snapshot.session.id,
      direction: "inbound",
      messageType: "user_input",
      content: "Please reuse sk-abcdefghijklmnopqrstuvwxyz123456 for debugging.",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-04-07T10:00:00.000Z",
    });

    const diagnostics = new DiagnosticsService(
      new InspectService(store),
      new HealthService(db, store),
      new StructuredLogger(),
    );
    const exportService = new DiagnosticsExportService(diagnostics, store, {
      rootDir: artifactRoot,
    });

    const exported = exportService.exportMinimalReproBundle(snapshot.task.id);
    const persisted = readFileSync(exported.artifact.uri, "utf8");

    assert.doesNotMatch(JSON.stringify(exported.bundle), /secret-token-1234567890|sk-abcdefghijklmnopqrstuvwxyz123456/);
    assert.match(JSON.stringify(exported.bundle), /\[REDACTED\]/);
    assert.doesNotMatch(persisted, /secret-token-1234567890|sk-abcdefghijklmnopqrstuvwxyz123456/);
    assert.match(persisted, /\[REDACTED\]/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("stalled escalation export stays within the configured artifact root and records escalation artifacts", () => {
  const workspace = createTempWorkspace("aa-stalled-export-security-");
  const dbPath = join(workspace, "stalled-export-security.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-stalled-export-security",
      executionId: "exec-stalled-export-security",
      traceId: "trace-stalled-export-security",
    });
    db.connection.prepare(
      `UPDATE workflow_state SET status = ?, current_step_index = ?, updated_at = ? WHERE task_id = ?`,
    ).run("running", 0, "2000-01-01T00:00:00.000Z", "task-stalled-export-security");
    db.connection.prepare(`UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`).run(
      "in_progress",
      null,
      "2000-01-01T00:00:00.000Z",
      "task-stalled-export-security",
    );
    db.connection.prepare(`UPDATE executions SET status = ?, finished_at = ?, updated_at = ? WHERE id = ?`).run(
      "executing",
      null,
      "2000-01-01T00:00:00.000Z",
      "exec-stalled-export-security",
    );
    store.upsertAgentExecutionRecord({
      executionId: "exec-stalled-export-security",
      taskId: "task-stalled-export-security",
      agentId: "agent-1",
      workflowId: "single_agent_minimal",
      roleId: "general_executor",
      runKind: "task_run",
      runtimeInstanceId: "runtime-stalled-export-1",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      status: "executing",
      planJson: "{}",
      currentStepId: "step-stalled-export",
      lastToolName: "bash.exec",
      toolCallCount: 1,
      lastDecisionJson: null,
      lastErrorCode: null,
      retryCount: 0,
      progressMessage: "waiting",
      startedAt: "2000-01-01T00:00:00.000Z",
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
      completedAt: null,
    });
    const diagnostics = new DiagnosticsService(
      new InspectService(store),
      new HealthService(db, store),
      new StructuredLogger(),
    );
    const escalationService = new StalledExecutionEscalationService(
      new StalledExecutionDetector(store),
      diagnostics,
    );
    const exportService = new DiagnosticsExportService(diagnostics, store, {
      rootDir: artifactRoot,
    });

    const exported = exportService.exportStalledExecutionEscalations(escalationService.buildPackages());
    const normalizedRoot = resolve(artifactRoot);

    assert.equal(exported.packages.length, 1);
    assert.equal(exported.artifacts.length, 1);
    assert.equal(exported.artifacts[0]?.uri.startsWith(normalizedRoot), true);
    assert.equal(exported.artifacts[0]?.uri.includes(".."), false);
    assert.equal(exported.artifacts[0]?.uri.endsWith(".json"), true);
    assert.deepEqual(
      store.listArtifactsByTask("task-stalled-export-security").slice(-1).map((artifact) => artifact.kind),
      ["stalled_execution_escalation"],
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
