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
