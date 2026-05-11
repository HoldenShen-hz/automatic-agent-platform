import assert from "node:assert/strict";
import test from "node:test";

import { EscalationService } from "../../../../src/platform/five-plane-orchestration/escalation/index.js";

test("escalation cost approval threshold is driven by request policy override", () => {
  const service = new EscalationService();
  const baseRequest = {
    taskId: "task-001",
    executionId: "exec-001",
    tenantId: "tenant-1",
    stage: "plan" as const,
    riskLevel: "medium" as const,
    reasonCode: "cost-check",
    estimatedCostUsd: 8,
    affectsProduction: false,
  };

  const defaultDecision = service.decide(baseRequest);
  assert.equal(defaultDecision.decision, "none");

  const tenantPolicyDecision = service.decide({
    ...baseRequest,
    costThresholdUsd: 5,
  });
  assert.equal(tenantPolicyDecision.decision, "approval");
  assert.equal(tenantPolicyDecision.reasonCode, "escalation.approval_required");
});

test("escalation routes execute-stage high risk decisions into the HITL takeover handler", () => {
  const takeoverRequests: { taskId: string; stage: string; reasonCode: string }[] = [];
  const notifications: string[] = [];
  const service = new EscalationService({
    hitlTakeoverHandler(request) {
      takeoverRequests.push({
        taskId: request.taskId,
        stage: request.stage,
        reasonCode: request.reasonCode,
      });
      return request;
    },
    operatorNotificationHandler(notification) {
      notifications.push(notification.decision);
      return notification;
    },
  });

  const decision = service.decide({
    taskId: "task-hitl",
    executionId: "exec-hitl",
    tenantId: "tenant-1",
    stage: "execute",
    riskLevel: "high",
    reasonCode: "execution.high_risk",
    estimatedCostUsd: 1,
    affectsProduction: false,
    slaDeadline: null,
    timeoutMs: null,
  });

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.workflowState, "paused_for_takeover");
  assert.equal(decision.blocksExecution, true);
  assert.deepEqual(takeoverRequests, [{
    taskId: "task-hitl",
    stage: "execute",
    reasonCode: "execution.high_risk",
  }]);
  assert.deepEqual(notifications, ["takeover"]);
});
