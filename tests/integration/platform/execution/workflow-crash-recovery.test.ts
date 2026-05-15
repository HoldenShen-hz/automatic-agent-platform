import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-execution.js";
import { runMultiStepOrchestration } from "../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import { RuntimeRecoveryService } from "../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service-root.js";
import { RuntimeRepairService } from "../../../../src/platform/five-plane-execution/recovery/runtime-repair-service-root.js";
import { StartupConsistencyChecker } from "../../../../src/platform/five-plane-execution/startup/startup-consistency-checker.js";
import {
  InjectedWorkflowCrashError,
  isInjectedWorkflowCrashError,
} from "../../../../src/platform/five-plane-execution/recovery/workflow-crash-simulator.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function buildRecoveryReport(db: SqliteDatabase, store: AuthoritativeTaskStore, executionId: string) {
  const checker = new StartupConsistencyChecker(db, store);
  const execution = store.getExecution(executionId);
  const baseMs = execution?.updatedAt ? Date.parse(execution.updatedAt) : Date.now();
  return checker.run({
    now: new Date(baseMs + 2 * 60_000).toISOString(),
    staleExecutionAfterMs: 60_000,
    pendingAckOlderThanMs: 3_600_000,
  });
}

test("single-task crash injection at step start leaves a stale execution without a checkpoint", async () => {
  const workspace = createTempWorkspace("aa-workflow-crash-");
  const dbPath = join(workspace, "single-task-step-start.db");

  try {
    let injected: InjectedWorkflowCrashError | null = null;
    try {
      await runSingleTaskExecution({
        dbPath,
        title: "Single-task crash at step start",
        request: "Crash before the first step commits anything.",
        crashInjection: {
          point: "step_started",
          stepId: "analyze_request",
        },
      });
    } catch (error) {
      if (isInjectedWorkflowCrashError(error)) {
        injected = error;
      } else {
        throw error;
      }
    }

    assert.ok(injected);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const snapshot = store.loadTaskSnapshot(injected.taskId);
    const recovery = new RuntimeRecoveryService(store);
    const view = recovery.buildRuntimeRecoveryView(injected.taskId);
    const before = buildRecoveryReport(db, store, injected.executionId);
    const repair = new RuntimeRepairService(db, store);
    const applied = await repair.apply(before);
    const after = buildRecoveryReport(db, store, injected.executionId);

    assert.equal(snapshot.task.status, "in_progress");
    assert.equal(snapshot.execution?.status, "executing");
    assert.equal(snapshot.stepOutputs.length, 0);
    assert.equal(view.latestCheckpoint, null);
    assert.equal(before.status, "repairable");
    assert.ok(before.findings.some((finding) => finding.code === "stale_execution" && finding.entityId === injected.executionId));
    assert.ok(applied.some((result) => result.action === "requeue_execution" && result.targetId === injected.executionId && result.applied));
    assert.equal(after.status, "pass");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("single-task crash injection after tool completion preserves the latest checkpoint for recovery", async () => {
  const workspace = createTempWorkspace("aa-workflow-crash-");
  const dbPath = join(workspace, "single-task-tool-completed.db");

  try {
    let injected: InjectedWorkflowCrashError | null = null;
    try {
      await runSingleTaskExecution({
        dbPath,
        title: "Single-task crash after tool completion",
        request: "Crash after the step output is durable but before terminal commit.",
        crashInjection: {
          point: "tool_completed",
          stepId: "analyze_request",
        },
      });
    } catch (error) {
      if (isInjectedWorkflowCrashError(error)) {
        injected = error;
      } else {
        throw error;
      }
    }

    assert.ok(injected);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const snapshot = store.loadTaskSnapshot(injected.taskId);
    const recovery = new RuntimeRecoveryService(store);
    const view = recovery.buildRuntimeRecoveryView(injected.taskId);
    const before = buildRecoveryReport(db, store, injected.executionId);
    const repair = new RuntimeRepairService(db, store);
    await repair.apply(before);
    const after = buildRecoveryReport(db, store, injected.executionId);

    assert.equal(snapshot.task.status, "in_progress");
    assert.equal(snapshot.execution?.status, "executing");
    assert.equal(snapshot.stepOutputs.length, 1);
    assert.equal(view.latestCheckpoint?.stepId, "analyze_request");
    assert.equal(view.latestCheckpoint?.outputKeys.includes("analysis"), true);
    assert.equal(before.status, "repairable");
    assert.ok(before.findings.some((finding) => finding.code === "stale_execution" && finding.entityId === injected.executionId));
    assert.equal(after.status, "pass");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step crash injection before commit keeps the previous stable checkpoint for recovery", async () => {
  const workspace = createTempWorkspace("aa-workflow-crash-");
  const dbPath = join(workspace, "multi-step-before-commit.db");

  try {
    let injected: InjectedWorkflowCrashError | null = null;
    try {
      await runMultiStepOrchestration({
        dbPath,
        title: "Multi-step crash before commit",
        request: "Summarize the task in detail and draft a comprehensive summary document.",
        crashInjection: {
          point: "before_commit",
          stepId: "draft_solution",
        },
      });
    } catch (error) {
      if (isInjectedWorkflowCrashError(error)) {
        injected = error;
      } else {
        throw error;
      }
    }

    assert.ok(injected);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const snapshot = store.loadTaskSnapshot(injected.taskId);
    const recovery = new RuntimeRecoveryService(store);
    const view = recovery.buildRuntimeRecoveryView(injected.taskId);
    const before = buildRecoveryReport(db, store, injected.executionId);
    const repair = new RuntimeRepairService(db, store);
    await repair.apply(before);
    const after = buildRecoveryReport(db, store, injected.executionId);

    assert.equal(snapshot.task.status, "in_progress");
    assert.equal(snapshot.execution?.id, injected.executionId);
    assert.equal(snapshot.execution?.status, "executing");
    assert.deepEqual(snapshot.stepOutputs.map((step) => step.stepId), ["intake_triage"]);
    assert.equal(snapshot.workflow?.currentStepIndex, 1);
    assert.equal(view.latestCheckpoint?.stepId, "intake_triage");
    assert.equal(before.status, "repairable");
    assert.ok(before.findings.some((finding) => finding.code === "stale_execution" && finding.entityId === injected.executionId));
    assert.equal(after.status, "pass");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
