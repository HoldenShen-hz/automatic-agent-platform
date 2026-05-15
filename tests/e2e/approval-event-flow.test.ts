import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { ApprovalService } from "../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { DurableEventBus } from "../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import { seedTaskAndExecution } from "../helpers/seed.js";

test("E2E: blocked-for-approval flow emits tier1 events and drains consumer acks", async () => {
  const workspace = createTempWorkspace("e2e-approval-event-flow-");

  try {
    const db = new SqliteDatabase(join(workspace, "approval-event-flow.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const transitions = new TransitionService(db, store);
    const approvals = new ApprovalService(db, store);
    const bus = new DurableEventBus(db, store);
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = "e2e-approval-trace";
    const now = nowIso();
    const seenByConsumer = new Map<string, string[]>();

    seedTaskAndExecution(db, store, { taskId, executionId, traceId });
    db.transaction(() => {
      store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    for (const consumerId of ["task_projection", "approval_projection", "inspect_projection"]) {
      seenByConsumer.set(consumerId, []);
      bus.subscribe(consumerId, async (event) => {
        seenByConsumer.get(consumerId)?.push(event.eventType);
      });
    }

    const blocked = transitions.transitionBlockedForApproval({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      workflowCurrentStepIndex: 0,
      workflowOutputsJson: "{}",
      approval: {
        sourceAgentId: "agent-1",
        reason: "Operator approval required for destructive action",
        riskLevel: "high",
        options: ["approve", "reject"],
        context: { toolName: "exec_command", command: "rm -rf ./tmp" },
        timeoutPolicy: "reject",
      },
      context: {
        reasonCode: "approval.required",
        traceId,
        actorType: "agent",
        actorId: "agent-1",
        occurredAt: now,
      },
    });

    assert.equal(store.getTask(taskId)?.status, "awaiting_decision");
    assert.equal(store.getExecution(executionId)?.status, "blocked");
    assert.equal(store.selectLatestSessionByTask(taskId)?.status, "awaiting_user");
    assert.equal(store.getWorkflowState(taskId)?.status, "paused");
    assert.equal(store.getApproval(blocked.approvalId)?.status, "requested");
    assert.ok(store.countPendingTier1Acks() > 0);

    await bus.deliverPending("task_projection");
    await bus.deliverPending("approval_projection");
    await bus.deliverPending("inspect_projection");

    assert.deepEqual(seenByConsumer.get("task_projection"), ["task:status_changed"]);
    assert.deepEqual(seenByConsumer.get("approval_projection"), ["decision:requested"]);
    assert.deepEqual(
      [...(seenByConsumer.get("inspect_projection") ?? [])].sort(),
      ["decision:requested", "task:status_changed"],
    );

    approvals.applyDecision({
      approvalId: blocked.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    await bus.deliverPending("approval_projection");
    await bus.deliverPending("inspect_projection");

    assert.equal(store.getApproval(blocked.approvalId)?.status, "approved");
    assert.deepEqual(seenByConsumer.get("approval_projection"), ["decision:requested", "decision:responded"]);
    assert.deepEqual(
      [...(seenByConsumer.get("inspect_projection") ?? [])].sort(),
      ["decision:requested", "decision:responded", "task:status_changed"],
    );
    assert.equal(store.countPendingTier1Acks(), 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
