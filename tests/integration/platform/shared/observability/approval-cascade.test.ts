import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("inspect service exposes cascade-denied sibling approvals after a session rejection", () => {
  const workspace = createTempWorkspace("aa-approval-cascade-");
  const dbPath = join(workspace, "approval-cascade.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvals = new ApprovalService(db, store);
    const inspect = new InspectService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-approval-cascade",
      executionId: "exec-approval-cascade",
      traceId: "trace-approval-cascade",
    });

    const root = approvals.createRequest({
      taskId: "task-approval-cascade",
      executionId: "exec-approval-cascade",
      sourceAgentId: "agent-approval",
      reason: "Need shell approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { sessionId: "approval-session-1", command: "bash" },
      timeoutPolicy: "reject",
    });
    const sibling = approvals.createRequest({
      taskId: "task-approval-cascade",
      executionId: "exec-approval-cascade",
      sourceAgentId: "agent-approval",
      reason: "Need edit approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { sessionId: "approval-session-1", tool: "edit" },
      timeoutPolicy: "reject",
    });
    approvals.createRequest({
      taskId: "task-approval-cascade",
      executionId: "exec-approval-cascade",
      sourceAgentId: "agent-approval",
      reason: "Need unrelated approval",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: { sessionId: "approval-session-2", tool: "read" },
      timeoutPolicy: "reject",
    });

    approvals.applyDecision({
      approvalId: root.approvalId,
      decisionType: "rejected",
      respondedBy: "user-approval",
      respondedAt: "2026-04-05T11:00:00.000Z",
    });

    const approvalInspect = inspect.getApprovalInspectView(sibling.approvalId);
    const siblingInspect = approvalInspect.approvals.find((item) => item.id === sibling.approvalId);
    const cascadeEvent = approvalInspect.recentEvents.find(
      (event) => event.eventType === "decision:responded" && event.payloadJson.includes(`"approvalId":"${sibling.approvalId}"`),
    );

    assert.equal(approvalInspect.approval.status, "rejected");
    assert.equal(siblingInspect?.status, "rejected");
    assert.match(siblingInspect?.responseJson ?? "", /"cascadeDeny":true/);
    assert.ok(cascadeEvent);
    assert.match(cascadeEvent?.payloadJson ?? "", /"cascadeSessionId":"approval-session-1"/);
    assert.equal(
      approvalInspect.approvals.filter((item) => item.status === "requested").length,
      1,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
