import assert from "node:assert/strict";
import test from "node:test";

import { EscalationService } from "../../../../src/platform/five-plane-orchestration/escalation/index.js";

function createRequest() {
  return {
    taskId: "task-1",
    executionId: "exec-1",
    tenantId: "tenant-1",
    stage: "plan" as const,
    riskLevel: "medium" as const,
    reasonCode: "cost-check",
    estimatedCostUsd: 8,
    affectsProduction: false,
    slaDeadline: null,
    timeoutMs: null,
  };
}

test("EscalationService respects per-request cost threshold overrides", () => {
  const service = new EscalationService();

  assert.equal(service.decide(createRequest()).decision, "none");
  assert.equal(
    service.decide({ ...createRequest(), costThresholdUsd: 5 }).decision,
    "approval",
  );
});

test("EscalationService routes execute-stage high risk decisions to takeover", () => {
  const takeoverRequests: string[] = [];
  const notifications: string[] = [];
  const service = new EscalationService({
    hitlTakeoverHandler(request) {
      takeoverRequests.push(request.reasonCode);
      return request;
    },
    operatorNotificationHandler(notification) {
      notifications.push(notification.decision);
      return notification;
    },
  });

  const decision = service.decide({
    ...createRequest(),
    stage: "execute",
    riskLevel: "high",
    reasonCode: "execution.high_risk",
  });

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.workflowState, "paused_for_takeover");
  assert.deepEqual(takeoverRequests, ["execution.high_risk"]);
  assert.deepEqual(notifications, ["takeover"]);
});

test("EscalationService escalates imminent timeouts before normal policy checks", () => {
  const service = new EscalationService();
  const decision = service.decide({
    ...createRequest(),
    timeoutMs: 30_000,
  });

  assert.equal(decision.decision, "approval");
  assert.equal(decision.reasonCode, "escalation.timeout_imminent_approval_required");
});
