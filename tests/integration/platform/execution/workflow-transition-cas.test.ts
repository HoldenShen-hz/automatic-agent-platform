/**
 * [SYS-REL-2.7] Workflow Transitions Lack CAS Tests
 *
 * Tests for concurrent workflow transitions to verify conflict detection.
 * Task transitions have CAS protection but workflow transitions do not.
 *
 * Defect: transition-service.ts WorkflowTransitionService.apply() does not use
 * CAS (compare-and-swap) when updating workflow status, allowing concurrent
 * transitions to overwrite each other.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../../../src/platform/execution/state-transition/transition-service.js";
import { createRuntimeLifecycleRepository } from "../../../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";
import { runConcurrentInvariant } from "../../../helpers/concurrent-runner.js";

test("[SYS-REL-2.7] concurrent workflow transitions detect conflict", async () => {
  const workspace = createTempWorkspace("aa-workflow-cas-");
  const dbPath = join(workspace, "cas-test.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitionService = new TransitionService(db, store, repository);

    const now = new Date().toISOString();
    const workflowId = "workflow-cas-test-001";

    // Insert a workflow in running state
    db.transaction(() => {
      store.insertTask({
        id: workflowId,
        parentId: null,
        rootId: workflowId,
        divisionId: "general_ops",
        tenantId: null,
        title: "CAS workflow test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ workflowId }),
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Set workflow status via repository
    repository.updateWorkflowState(workflowId, "running", 0, "{}", now);

    // Attempt two concurrent transitions: running -> completed and running -> failed
    const results = await Promise.allSettled([
      new Promise<void>((resolve, reject) => {
        try {
          transitionService.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: workflowId,
            fromStatus: "running",
            toStatus: "completed",
            currentStepIndex: 1,
            outputsJson: '{"result":"success"}',
            traceId: "trace-cas-1",
            correlationId: workflowId,
            idempotencyKey: "",
            metadataJson: "",
            reasonCode: "",
            reasonDetail: "",
            actorType: "system",
            actorId: "",
            occurredAt: now,
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      }),
      new Promise<void>((resolve, reject) => {
        try {
          transitionService.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: workflowId,
            fromStatus: "running",
            toStatus: "failed",
            currentStepIndex: 0,
            outputsJson: '{"error":"failed"}',
            traceId: "trace-cas-2",
            correlationId: workflowId,
            idempotencyKey: null,
            metadataJson: null,
            reasonCode: "WF_FAILED",
            reasonDetail: "Workflow failed",
            actorType: "system",
            actorId: "",
            occurredAt: new Date().toISOString(),
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      }),
    ]);

    // With proper CAS, exactly one transition should succeed and the other should be rejected
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // After fix: one should succeed, one should be rejected
    // Currently (with bug): both might succeed because there's no CAS
    assert.ok(
      succeeded.length === 1 && rejected.length === 1,
      `Expected 1 succeeded and 1 rejected, got ${succeeded.length} succeeded and ${rejected.length} rejected (defect: workflow transitions lack CAS)`,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-REL-2.7] workflow CAS error thrown when fromStatus doesn't match", () => {
  const workspace = createTempWorkspace("aa-workflow-cas-error-");
  const dbPath = join(workspace, "cas-error-test.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitionService = new TransitionService(db, store, repository);

    const now = new Date().toISOString();
    const workflowId = "workflow-cas-error-001";

    // Insert workflow
    db.transaction(() => {
      store.insertTask({
        id: workflowId,
        parentId: null,
        rootId: workflowId,
        divisionId: "general_ops",
        tenantId: null,
        title: "CAS error test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ workflowId }),
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Set workflow to completed state first
    repository.updateWorkflowState(workflowId, "completed", 1, "{}", now);

    // Now try to transition from 'running' to 'failed' - should fail because current state is 'completed'
    assert.throws(() => {
      transitionService.transitionWorkflowStatus({
        entityKind: "workflow",
        entityId: workflowId,
        fromStatus: "running", // This doesn't match current state
        toStatus: "failed",
        currentStepIndex: 0,
        outputsJson: "{}",
        traceId: "trace-error",
        correlationId: workflowId,
        idempotencyKey: null,
        metadataJson: null,
        reasonCode: null,
        reasonDetail: null,
        actorType: "system",
        actorId: null,
        occurredAt: now,
      });
    }, /fromStatus/);
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-REL-2.7] multiple concurrent transitions on same workflow", async () => {
  const workspace = createTempWorkspace("aa-workflow-multi-");
  const dbPath = join(workspace, "multi-transition.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitionService = new TransitionService(db, store, repository);

    const now = new Date().toISOString();
    const workflowId = "workflow-multi-001";

    db.transaction(() => {
      store.insertTask({
        id: workflowId,
        parentId: null,
        rootId: workflowId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Multi transition test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ workflowId }),
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    repository.updateWorkflowState(workflowId, "running", 0, "{}", now);

    // Run 5 concurrent transitions all trying to complete the workflow
    const result = await runConcurrentInvariant(
      async (workerId) => {
        try {
          transitionService.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: workflowId,
            fromStatus: "running",
            toStatus: "completed",
            currentStepIndex: workerId,
            outputsJson: JSON.stringify({ workerId }),
            traceId: `trace-${workerId}`,
            correlationId: workflowId,
            idempotencyKey: "",
            metadataJson: "",
            reasonCode: "",
            reasonDetail: "",
            actorType: "system",
            actorId: "",
            occurredAt: now,
          });
          return { success: true, workerId };
        } catch (err) {
          return { success: false, workerId, error: err };
        }
      },
      { concurrency: 5 },
    );

    const successfulTransitions = result.values.filter((v) => v.success);
    const failedTransitions = result.values.filter((v) => !v.success);

    // With proper CAS, only one should succeed
    // Without CAS (current bug), all might succeed
    assert.equal(
      successfulTransitions.length,
      1,
      `Expected exactly 1 successful transition due to CAS, got ${successfulTransitions.length} (defect: no CAS protection)`,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});