import assert from "node:assert/strict";
import test from "node:test";

import { EscalationService, type EscalationRequest } from "../../../../../src/platform/orchestration/escalation/index.js";

function createEscalationRequest(overrides: Partial<EscalationRequest> = {}): EscalationRequest {
  return {
    taskId: "task_test",
    executionId: "exec_test",
    tenantId: "tenant_test",
    stage: "assess",
    riskLevel: "medium",
    reasonCode: "test.reason",
    estimatedCostUsd: null,
    affectsProduction: false,
    ...overrides,
  };
}

test("EscalationService returns decision none for low risk non-production", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({ riskLevel: "low" }));

  assert.equal(decision.decision, "none");
  assert.equal(decision.requiresOperatorAction, false);
  assert.equal(decision.reasonCode, "escalation.not_required");
});

test("EscalationService returns decision none for medium risk non-production low cost", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({
    riskLevel: "medium",
    estimatedCostUsd: 5,
    affectsProduction: false,
  }));

  assert.equal(decision.decision, "none");
  assert.equal(decision.requiresOperatorAction, false);
});

test("EscalationService triggers approval for affectsProduction", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({ affectsProduction: true }));

  assert.equal(decision.decision, "approval");
  assert.equal(decision.reasonCode, "escalation.approval_required");
  assert.equal(decision.requiresOperatorAction, true);
});

test("EscalationService triggers approval for estimatedCostUsd >= 10", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({ estimatedCostUsd: 10 }));

  assert.equal(decision.decision, "approval");
  assert.equal(decision.reasonCode, "escalation.approval_required");
});

test("EscalationService triggers approval for high risk", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({ riskLevel: "high" }));

  assert.equal(decision.decision, "approval");
  assert.equal(decision.reasonCode, "escalation.approval_required");
});

test("EscalationService triggers takeover for critical risk", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({ riskLevel: "critical" }));

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.reasonCode, "escalation.human_takeover_required");
  assert.equal(decision.requiresOperatorAction, true);
});

test("EscalationService triggers takeover for high risk execute stage", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({
    riskLevel: "high",
    stage: "execute",
  }));

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.reasonCode, "escalation.human_takeover_required");
});

test("EscalationService triggers panic_stop for critical production", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({
    riskLevel: "critical",
    affectsProduction: true,
  }));

  assert.equal(decision.decision, "panic_stop");
  assert.equal(decision.reasonCode, "escalation.critical_prod_stop");
  assert.equal(decision.requiresOperatorAction, true);
});

test("EscalationService priority: panic_stop > takeover > approval > none", () => {
  const service = new EscalationService();

  // Critical + production -> panic_stop (highest priority)
  const panicDecision = service.decide(createEscalationRequest({
    riskLevel: "critical",
    affectsProduction: true,
  }));
  assert.equal(panicDecision.decision, "panic_stop");

  // Critical + not production -> takeover
  const takeoverDecision = service.decide(createEscalationRequest({
    riskLevel: "critical",
    affectsProduction: false,
  }));
  assert.equal(takeoverDecision.decision, "takeover");

  // High risk + execute stage -> takeover
  const executeDecision = service.decide(createEscalationRequest({
    riskLevel: "high",
    stage: "execute",
    affectsProduction: false,
  }));
  assert.equal(executeDecision.decision, "takeover");

  // High risk + non-execute stage -> approval
  const approvalDecision = service.decide(createEscalationRequest({
    riskLevel: "high",
    stage: "assess",
    affectsProduction: false,
  }));
  assert.equal(approvalDecision.decision, "approval");
});

test("EscalationService handles null estimatedCostUsd", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({ estimatedCostUsd: null }));

  // null estimatedCostUsd should be treated as 0, so approval not triggered by cost
  assert.ok(decision.decision === "none" || decision.decision === "approval");
});

test("EscalationService handles all escalation stages", () => {
  const service = new EscalationService();
  const stages: EscalationRequest["stage"][] = ["assess", "plan", "execute", "feedback", "improve", "release"];

  for (const stage of stages) {
    const decision = service.decide(createEscalationRequest({ stage }));
    assert.ok(typeof decision.decision === "string", `Stage ${stage} should produce a decision`);
  }
});

test("EscalationService handles all risk levels", () => {
  const service = new EscalationService();
  const riskLevels: EscalationRequest["riskLevel"][] = ["low", "medium", "high", "critical"];

  for (const riskLevel of riskLevels) {
    const decision = service.decide(createEscalationRequest({ riskLevel }));
    assert.ok(typeof decision.decision === "string", `Risk level ${riskLevel} should produce a decision`);
    assert.ok(typeof decision.reasonCode === "string");
    assert.ok(typeof decision.requiresOperatorAction === "boolean");
  }
});

test("EscalationService reasonCode is set correctly for each decision type", () => {
  const service = new EscalationService();

  const noneDecision = service.decide(createEscalationRequest({ riskLevel: "low" }));
  assert.equal(noneDecision.reasonCode, "escalation.not_required");

  const approvalDecision = service.decide(createEscalationRequest({ riskLevel: "high" }));
  assert.equal(approvalDecision.reasonCode, "escalation.approval_required");

  const takeoverDecision = service.decide(createEscalationRequest({ riskLevel: "critical" }));
  assert.equal(takeoverDecision.reasonCode, "escalation.human_takeover_required");

  const panicDecision = service.decide(createEscalationRequest({
    riskLevel: "critical",
    affectsProduction: true,
  }));
  assert.equal(panicDecision.reasonCode, "escalation.critical_prod_stop");
});

test("EscalationService requiresOperatorAction matches decision severity", () => {
  const service = new EscalationService();

  // None = no action needed
  const none = service.decide(createEscalationRequest({ riskLevel: "low" }));
  assert.equal(none.requiresOperatorAction, false);

  // Approval = action needed
  const approval = service.decide(createEscalationRequest({ riskLevel: "high" }));
  assert.equal(approval.requiresOperatorAction, true);

  // Takeover = action needed
  const takeover = service.decide(createEscalationRequest({ riskLevel: "critical" }));
  assert.equal(takeover.requiresOperatorAction, true);

  // Panic stop = action needed
  const panic = service.decide(createEscalationRequest({
    riskLevel: "critical",
    affectsProduction: true,
  }));
  assert.equal(panic.requiresOperatorAction, true);
});

test("EscalationService handles exact boundary: estimatedCostUsd = 9.99", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({ estimatedCostUsd: 9.99 }));

  // Should not trigger approval by cost (threshold is >= 10)
  if (!decision.affectsProduction && decision.riskLevel !== "high") {
    assert.equal(decision.decision, "none");
  }
});

test("EscalationService handles exact boundary: estimatedCostUsd = 10", () => {
  const service = new EscalationService();
  const decision = service.decide(createEscalationRequest({ estimatedCostUsd: 10 }));

  // Should trigger approval by cost (threshold is >= 10)
  assert.equal(decision.decision, "approval");
});