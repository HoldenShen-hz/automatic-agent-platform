import assert from "node:assert/strict";
import test from "node:test";

import { nowIso } from "../../src/platform/contracts/types/ids.js";
import { HumanTakeoverServiceAsync } from "../../src/scale-ecosystem/runtime-services/human-takeover-service-async.js";
import { createSeededE2EHarness } from "../helpers/e2e-harness.js";

function seedFailedMultiStepWorkflow(taskId: string, executionId: string, sessionId: string) {
  return {
    taskId,
    executionId,
    sessionId,
    workflowId: "single_division_multi_step_orchestration",
    outputsJson: JSON.stringify({
      triage: { summary: "triaged", result: "triaged" },
      draft: { summary: "stale draft", result: "drafted previously" },
    }),
  };
}

test("E2E: async human takeover retries a failed multi-step workflow, repositions recovery, and injects manual output", async () => {
  const seeded = seedFailedMultiStepWorkflow(
    "task-runtime-recovery",
    "exec-runtime-recovery",
    "sess-runtime-recovery",
  );
  const harness = createSeededE2EHarness("aa-e2e-runtime-recovery-", {
    taskId: seeded.taskId,
    executionId: seeded.executionId,
  });

  try {
    const now = nowIso();
    harness.db.transaction(() => {
      harness.db.connection
        .prepare("UPDATE executions SET workflow_id = ?, role_id = ?, status = ?, last_error_code = ?, updated_at = ?, finished_at = ? WHERE id = ?")
        .run(
          seeded.workflowId,
          "workflow_planner",
          "failed",
          "execution.failed",
          now,
          now,
          seeded.executionId,
        );
      harness.store.setTaskState({
        taskId: seeded.taskId,
        status: "failed",
        updatedAt: now,
        errorCode: "execution.failed",
        completedAt: now,
      });
      harness.store.insertWorkflowState({
        taskId: seeded.taskId,
        divisionId: "general_ops",
        workflowId: seeded.workflowId,
        currentStepIndex: 2,
        status: "failed",
        outputsJson: seeded.outputsJson,
        lastErrorCode: "execution.failed",
        retryCount: 0,
        resumableFromStep: "final_review",
        startedAt: now,
        updatedAt: now,
      });
      harness.store.insertSession({
        id: seeded.sessionId,
        taskId: seeded.taskId,
        channel: "cli",
        status: "failed",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const takeover = new HumanTakeoverServiceAsync(harness.db, harness.store);

    const opened = await takeover.openSession({
      taskId: seeded.taskId,
      operatorId: "operator-runtime-recovery",
      reasonCode: "incident.retry",
    });
    const retried = await takeover.retryExecution({
      takeoverSessionId: opened.takeoverSessionId,
      reasonCode: "takeover.retry_execution",
    });
    await takeover.setCurrentStep({
      takeoverSessionId: opened.takeoverSessionId,
      stepId: "draft_solution",
      reasonCode: "takeover.set_current_step",
    });
    await takeover.writeStepOutput({
      takeoverSessionId: opened.takeoverSessionId,
      stepId: "draft_solution",
      outputJson: JSON.stringify({
        summary: "Manual draft restored",
        result: "Recovered draft output",
      }),
      reasonCode: "takeover.write_step_output",
      status: "succeeded",
    });
    await takeover.completeTask({
      takeoverSessionId: opened.takeoverSessionId,
      terminalStatus: "done",
      reasonCode: "takeover.complete_task",
      outputJson: JSON.stringify({ outcome: "manual_recovery_complete" }),
    });

    const snapshot = harness.store.loadTaskSnapshot(seeded.taskId);
    const workflowOutputs = JSON.parse(snapshot.workflow?.outputsJson ?? "{}") as Record<string, { result?: string; summary?: string }>;
    const operatorActions = harness.store.listOperatorActionsByTask(seeded.taskId);
    const eventTypes = harness.store.listEventsForTask(seeded.taskId).map((event) => event.eventType);
    const metrics = takeover.getMetrics();

    assert.notEqual(retried.executionId, seeded.executionId);
    assert.equal(snapshot.task.status, "completed");
    assert.equal(snapshot.task.outputJson, JSON.stringify({ outcome: "manual_recovery_complete" }));
    assert.equal(snapshot.execution?.id, retried.executionId);
    assert.equal(snapshot.execution?.status, "completed");
    assert.equal(snapshot.execution?.attempt, 2);
    assert.equal(snapshot.workflow?.status, "completed");
    assert.equal(snapshot.workflow?.currentStepIndex, 1);
    assert.equal(snapshot.workflow?.resumableFromStep, null);
    assert.equal(snapshot.workflow?.retryCount, 1);
    assert.notEqual(snapshot.session?.id, seeded.sessionId);
    assert.equal(snapshot.session?.status, "completed");
    assert.equal(snapshot.stepOutputs.length, 1);
    assert.equal(snapshot.stepOutputs[0]?.stepId, "draft_solution");
    assert.equal(snapshot.stepOutputs[0]?.status, "succeeded");
    assert.equal(snapshot.stepOutputs[0]?.summary, "Manual draft restored");
    assert.equal(workflowOutputs.draft?.result, "Recovered draft output");
    assert.equal(operatorActions.length, 5);
    assert.equal(operatorActions.at(-1)?.actionType, "complete_task");
    assert.ok(eventTypes.includes("takeover:session_opened"));
    assert.ok(eventTypes.includes("takeover:action_applied"));
    assert.ok(eventTypes.includes("workflow:step_completed"));
    assert.ok(eventTypes.includes("task:status_changed"));
    assert.equal(metrics.totalOperations, 5);
    assert.equal(metrics.successfulOperations, 5);
    assert.equal(metrics.failedOperations, 0);
    assert.equal(metrics.operationsByType.openSession, 1);
    assert.equal(metrics.operationsByType.retryExecution, 1);
    assert.equal(metrics.operationsByType.setCurrentStep, 1);
    assert.equal(metrics.operationsByType.writeStepOutput, 1);
    assert.equal(metrics.operationsByType.completeTask, 1);

    takeover.dispose();
  } finally {
    harness.cleanup();
  }
});
