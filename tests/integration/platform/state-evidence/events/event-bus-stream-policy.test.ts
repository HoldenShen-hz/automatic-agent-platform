import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { StreamBridge } from "../../../../../src/platform/interface/channel-gateway/stream-bridge.js";
import { PolicyEngine } from "../../../../../src/platform/control-plane/iam/policy-engine.js";
import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("event bus, stream bridge, policy, and approval form a minimal week2 baseline", async () => {
  const workspace = createTempWorkspace("aa-week2-");

  try {
    const db = new SqliteDatabase(join(workspace, "week2.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    const bridge = new StreamBridge();
    const approvalService = new ApprovalService(db, store);
    const frames: number[] = [];
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    const streamId = bridge.createStreamId("task-1", "cli");
    bus.subscribe("inspect_projection", async (event) => {
      frames.push(bridge.emitFromEvent({ streamId, channel: "cli", event }).sequence);
    });

    const policy = new PolicyEngine({
      budgetPolicy: {
        maxTaskCostUsd: 10,
        maxDailyCostUsd: 100,
        maxMonthlyCostUsd: 1000,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
    });

    const decision = policy.evaluate({
      decisionId: "dec-1",
      taskId: "task-1",
      executionId: "exec-1",
      subjectType: "agent",
      subjectId: "agent-1",
      action: "exec_command",
      riskCategory: "destructive",
      mode: "supervised",
      estimatedCostUsd: 1,
    });

    assert.equal(decision.decision, "escalate_for_approval");

    const approval = approvalService.createRequest({
      taskId: "task-1",
      executionId: "exec-1",
      sourceAgentId: "agent-1",
      reason: "High-risk command",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { command: "rm -rf" },
      timeoutPolicy: "reject",
    });

    await bus.deliverPending("inspect_projection");
    approvalService.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "user-1",
      respondedAt: new Date().toISOString(),
    });
    await bus.deliverPending("inspect_projection");

    assert.ok(frames.length >= 2);
    assert.deepEqual(
      bridge.replayAfterSequence(streamId, 1).map((frame) => frame.sequence),
      frames.filter((sequence) => sequence > 1),
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
