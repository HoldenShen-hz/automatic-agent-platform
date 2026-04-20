import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { ApprovalService } from "../../../src/platform/control-plane/approval-center/approval-service.js";
import { HitlApprovalOrchestrationService } from "../../../src/platform/orchestration/hitl/hitl-approval-orchestration-service.js";
import { HITLExplainabilityService } from "../../../src/platform/orchestration/hitl/hitl-explainability-service.js";
import { HitlOperatorConsoleService } from "../../../src/platform/orchestration/hitl/hitl-operator-console-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { seedTaskAndExecution } from "../../helpers/seed.js";
import { nowIso } from "../../../src/platform/contracts/types/ids.js";

test("integration: HITL approval packets flow into operator console queue and resolve after decision", async () => {
  const workspace = createTempWorkspace("aa-hitl-console-integration-");
  const dbPath = join(workspace, "hitl-console.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task_hitl_console_1", executionId: "exec_hitl_console_1" });

    const approvalService = new ApprovalService(db, store);
    const explainability = new HITLExplainabilityService(store);
    const consoleService = new HitlOperatorConsoleService(
      [
        { channel: "slack", minRiskLevel: "high" },
        { channel: "pager", minRiskLevel: "critical", stages: ["release"] },
      ],
      async ({ channel, packet }) => ({
        delivered: true,
        deliveryId: `${channel}:${packet.approvalId}`,
      }),
    );
    const hitlService = new HitlApprovalOrchestrationService(approvalService, explainability, consoleService);

    const packet = await hitlService.requestApproval({
      taskId: "task_hitl_console_1",
      executionId: "exec_hitl_console_1",
      sourceAgentId: "agent_release",
      title: "Release approval",
      reason: "Need operator approval before production rollout",
      riskLevel: "critical",
      stageRef: "release",
      options: [
        { optionId: "advance_rollout", label: "Advance", style: "primary", requiresConfirm: true },
        { optionId: "rollback", label: "Rollback", style: "danger", requiresConfirm: true },
      ],
      timeoutPolicy: "reject",
      context: {
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
      },
    });

    const queued = consoleService.listQueue({ tenantId: "tenant-1" });
    assert.equal(queued.length, 1);
    assert.deepEqual(queued[0]?.deliveryChannels, ["console", "slack", "pager"]);

    consoleService.acknowledge(packet.approvalId, "operator-1");
    const decisionResult = hitlService.applyDecision({
      approvalId: packet.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "advance_rollout",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });
    const resolved = consoleService.resolve(packet.approvalId, decisionResult.feedbackLink);

    assert.equal(resolved.status, "resolved");
    assert.equal(decisionResult.feedbackLink.decisionEffect, "advance_rollout");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
