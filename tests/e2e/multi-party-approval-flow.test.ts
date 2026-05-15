import assert from "node:assert/strict";
import test from "node:test";

import { MultiPartyApprovalService } from "../../src/platform/five-plane-control-plane/approval-center/multi-party-approval-service.js";
import { createSeededE2EHarness } from "../helpers/e2e-harness.js";

test("E2E: multi-party approval records partial approvals before quorum is met", () => {
  const harness = createSeededE2EHarness("aa-e2e-multi-party-approval-", {
    taskId: "task-multi-approve",
    executionId: "exec-multi-approve",
  });

  try {
    const service = new MultiPartyApprovalService(harness.db, harness.store);
    const approval = service.createMultiPartyRequest(
      {
        taskId: "task-multi-approve",
        executionId: "exec-multi-approve",
        sourceAgentId: "agent-rollout",
        reason: "Promote a risky rollout into regulated scope.",
        riskLevel: "high",
        options: ["approve", "reject"],
        context: {
          changeId: "rollout-42",
          environment: "production",
        },
        timeoutPolicy: "reject",
      },
      {
        requiredApprovals: 2,
        approverGroups: ["ops", "security", "finance"],
      },
    );

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "ops",
      respondedAt: "2026-04-24T10:00:00.000Z",
    });

    const inFlightRecord = harness.store.getApproval(approval.approvalId);
    const inFlightRequest = JSON.parse(inFlightRecord?.requestJson ?? "{}") as {
      approvalsReceived?: number;
    };
    assert.equal(inFlightRecord?.status, "requested");
    assert.equal(inFlightRequest.approvalsReceived, 1);
    assert.deepEqual(service.getApprovalProgress(approval.approvalId), {
      received: 1,
      required: 2,
      remaining: 1,
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "security",
      respondedAt: "2026-04-24T10:01:00.000Z",
    });

    const finalRecord = harness.store.getApproval(approval.approvalId);
    const finalResponse = JSON.parse(finalRecord?.responseJson ?? "{}") as {
      selectedOptionId?: string;
      respondedBy?: string;
    };
    assert.equal(finalRecord?.status, "approved");
    assert.equal(finalResponse.selectedOptionId, "approve");
    assert.equal(finalResponse.respondedBy, "security");

    const eventTypes = harness.store.listEventsForTask("task-multi-approve").map((event) => event.eventType);
    assert.ok(eventTypes.includes("decision:requested"));
    assert.ok(eventTypes.includes("decision:partial_approval"));
    assert.ok(eventTypes.includes("decision:approved"));
  } finally {
    harness.cleanup();
  }
});

test("E2E: multi-party approval rejects immediately when a participant denies the request", () => {
  const harness = createSeededE2EHarness("aa-e2e-multi-party-reject-", {
    taskId: "task-multi-reject",
    executionId: "exec-multi-reject",
  });

  try {
    const service = new MultiPartyApprovalService(harness.db, harness.store);
    const approval = service.createMultiPartyRequest(
      {
        taskId: "task-multi-reject",
        executionId: "exec-multi-reject",
        sourceAgentId: "agent-runtime",
        reason: "Delete a tenant-scoped production artifact.",
        riskLevel: "critical",
        options: ["approve", "reject"],
        context: {
          artifactId: "artifact-prod-7",
        },
        timeoutPolicy: "reject",
      },
      {
        requiredApprovals: 3,
        approverGroups: ["ops", "security", "tenant-admin"],
      },
    );

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "rejected",
      respondedBy: "security",
      respondedAt: "2026-04-24T10:05:00.000Z",
    });

    const finalRecord = harness.store.getApproval(approval.approvalId);
    assert.equal(finalRecord?.status, "rejected");
    assert.equal(service.getPendingApproval(approval.approvalId)?.status, "rejected");

    const eventTypes = harness.store.listEventsForTask("task-multi-reject").map((event) => event.eventType);
    assert.ok(eventTypes.includes("decision:requested"));
    assert.ok(eventTypes.includes("decision:rejected"));
    assert.ok(!eventTypes.includes("decision:approved"));
  } finally {
    harness.cleanup();
  }
});
