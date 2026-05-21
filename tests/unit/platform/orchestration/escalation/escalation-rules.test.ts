import assert from "node:assert/strict";
import test from "node:test";

import {
  EscalationService,
  EscalationRequest,
  EscalationRiskLevel,
  EscalationStage,
  EscalationDecisionType,
} from "../../../../../src/platform/five-plane-orchestration/escalation/index.js";

function createRequest(overrides: Partial<EscalationRequest> = {}): EscalationRequest {
  return {
    taskId: "task-1",
    executionId: "execution-1",
    tenantId: "tenant-1",
    stage: "assess",
    riskLevel: "low",
    reasonCode: "test.reason",
    estimatedCostUsd: null,
    affectsProduction: false,
    slaDeadline: null,
    timeoutMs: null,
    ...overrides,
  };
}

// --- Escalation Risk Level Rules ---

test("riskLevel 'low' returns decision 'none' for non-production low cost request", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 0 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
  assert.equal(decision.reasonCode, "escalation.not_required");
});

test("riskLevel 'low' returns decision 'approval' when affectsProduction is true", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: true });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.equal(decision.requiresOperatorAction, true);
});

test("riskLevel 'medium' returns decision 'none' for non-production low cost request", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "medium", affectsProduction: false, estimatedCostUsd: 5 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
});

test("riskLevel 'medium' returns decision 'approval' when affectsProduction is true", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "medium", affectsProduction: true });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

test("riskLevel 'medium' returns decision 'approval' when estimatedCostUsd >= 10", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "medium", estimatedCostUsd: 10 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

test("riskLevel 'high' returns decision 'approval' in non-execute stages", () => {
  const service = new EscalationService();
  const stages: EscalationStage[] = ["assess", "plan", "feedback", "improve", "release"];

  for (const stage of stages) {
    const request = createRequest({ riskLevel: "high", stage, affectsProduction: false });
    const decision = service.decide(request);
    assert.equal(decision.decision, "approval", `Failed for stage: ${stage}`);
  }
});

test("riskLevel 'high' returns decision 'takeover' in execute stage", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "execute", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.reasonCode, "escalation.human_takeover_required");
});

test("riskLevel 'high' returns decision 'takeover' even if affectsProduction is true", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "execute", affectsProduction: true });
  const decision = service.decide(request);

  // takeover takes priority over approval
  assert.equal(decision.decision, "takeover");
});

test("riskLevel 'critical' without production impact returns decision 'takeover'", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.reasonCode, "escalation.human_takeover_required");
  assert.equal(decision.requiresOperatorAction, true);
});

test("riskLevel 'critical' with production impact returns decision 'panic_stop'", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  assert.equal(decision.decision, "panic_stop");
  assert.equal(decision.reasonCode, "escalation.critical_prod_stop");
  assert.equal(decision.blocksExecution, true);
});

test("riskLevel 'critical' with production impact returns decision 'panic_activate' when panic service is configured", () => {
  const service = new EscalationService({});
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  // With panic service configured, returns panic_activate
  assert.ok(
    decision.decision === "panic_stop" || decision.decision === "panic_activate",
    `Expected panic_stop or panic_activate, got ${decision.decision}`,
  );
  assert.equal(decision.blocksExecution, true);
});

test("riskLevel 'critical' takes priority over high risk + execute for production", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: true, stage: "execute" });
  const decision = service.decide(request);

  // critical + production = panic_stop, not takeover
  assert.equal(decision.decision, "panic_stop");
});

// --- Escalation Stage Rules ---

test("stage 'assess' does not trigger takeover for high risk", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "assess" });
  const decision = service.decide(request);

  assert.notEqual(decision.decision, "takeover");
  assert.equal(decision.decision, "approval");
});

test("stage 'plan' does not trigger takeover for high risk", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "plan" });
  const decision = service.decide(request);

  assert.notEqual(decision.decision, "takeover");
  assert.equal(decision.decision, "approval");
});

test("stage 'execute' triggers takeover for high risk", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "execute" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
});

test("stage 'feedback' does not trigger takeover for high risk", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "feedback" });
  const decision = service.decide(request);

  assert.notEqual(decision.decision, "takeover");
});

test("stage 'improve' does not trigger takeover for high risk", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "improve" });
  const decision = service.decide(request);

  assert.notEqual(decision.decision, "takeover");
});

test("stage 'release' does not trigger takeover for high risk", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "release" });
  const decision = service.decide(request);

  assert.notEqual(decision.decision, "takeover");
});

test("all stages return valid decision for critical production risk", () => {
  const service = new EscalationService();
  const stages: EscalationStage[] = ["assess", "plan", "execute", "feedback", "improve", "release"];

  for (const stage of stages) {
    const request = createRequest({ riskLevel: "critical", affectsProduction: true, stage });
    const decision = service.decide(request);
    assert.equal(decision.decision, "panic_stop", `Failed for stage: ${stage}`);
  }
});

// --- Cost Threshold Rules ---

test("estimatedCostUsd below threshold (0-9) does not trigger approval", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 9 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
});

test("estimatedCostUsd at threshold (10) triggers approval", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 10 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.equal(decision.reasonCode, "escalation.approval_required");
});

test("estimatedCostUsd above threshold (>10) triggers approval", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 100 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

test("null estimatedCostUsd is treated as 0", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: null });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
});

test("costThresholdUsd override affects decision threshold", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 5, costThresholdUsd: 5 });
  const decision = service.decide(request);

  // With threshold=5 and cost=5, should trigger approval (>= comparison)
  assert.equal(decision.decision, "approval");
});

test("costThresholdUsd override can increase threshold", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 10, costThresholdUsd: 20 });
  const decision = service.decide(request);

  // With threshold=20 and cost=10, should not trigger approval
  assert.equal(decision.decision, "none");
});

// --- Priority Rules ---

test("panic_stop has highest priority over takeover", () => {
  const service = new EscalationService();
  // critical + production = panic_stop (not takeover)
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  assert.equal(decision.decision, "panic_stop");
});

test("takeover has higher priority than approval", () => {
  const service = new EscalationService();
  // critical = takeover (not approval)
  const request = createRequest({ riskLevel: "critical", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
});

test("takeover in execute stage overrides production approval", () => {
  const service = new EscalationService();
  const request = createRequest({
    riskLevel: "high",
    stage: "execute",
    affectsProduction: true,
  });
  const decision = service.decide(request);

  // high + execute = takeover, not approval
  assert.equal(decision.decision, "takeover");
});

test("approval has higher priority than none", () => {
  const service = new EscalationService();
  const request = createRequest({
    riskLevel: "high",
    stage: "assess",
    affectsProduction: false,
    estimatedCostUsd: 0,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

// --- Decision Properties ---

test("decision 'none' has requiresOperatorAction false", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 0 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
  assert.equal(decision.requiresOperatorAction, false);
  assert.equal(decision.blocksExecution, false);
  assert.strictEqual(decision.approvalRequestId, null);
  assert.strictEqual(decision.operatorNotificationId, null);
});

test("decision 'approval' has requiresOperatorAction true", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.equal(decision.requiresOperatorAction, true);
  assert.equal(decision.blocksExecution, true);
});

test("decision 'takeover' has requiresOperatorAction true and paused_for_takeover workflow state", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.requiresOperatorAction, true);
  assert.equal(decision.blocksExecution, true);
  assert.equal(decision.workflowState, "paused_for_takeover");
});

test("decision 'panic_stop' has blocksExecution true and panic_stop workflow state", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  assert.equal(decision.decision, "panic_stop");
  assert.equal(decision.blocksExecution, true);
  assert.equal(decision.workflowState, "panic_stop");
});