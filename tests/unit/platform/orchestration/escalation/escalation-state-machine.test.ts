import assert from "node:assert/strict";
import test from "node:test";

import {
  EscalationService,
  EscalationRequest,
  EscalationRiskLevel,
  EscalationStage,
  EscalationDecisionType,
} from "../../../../../src/platform/orchestration/escalation/index.js";

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
    ...overrides,
  };
}

test("EscalationService can be instantiated", () => {
  const service = new EscalationService();
  assert.ok(service instanceof EscalationService);
});

test("EscalationService.decide returns panic_stop for critical risk with production impact", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  assert.equal(decision.decision, "panic_stop");
  assert.ok(decision.reasonCode.includes("panic.cascade_halt"));
  assert.equal(decision.requiresOperatorAction, true);
});

test("EscalationService.decide returns panic_stop regardless of stage", () => {
  const service = new EscalationService();
  const stages: EscalationStage[] = ["assess", "plan", "execute", "feedback", "improve", "release"];

  for (const stage of stages) {
    const request = createRequest({ riskLevel: "critical", affectsProduction: true, stage });
    const decision = service.decide(request);
    assert.equal(decision.decision, "panic_stop", `Failed for stage: ${stage}`);
  }
});

test("EscalationService.decide returns takeover for critical risk without production impact", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.reasonCode, "escalation.human_takeover_required");
  assert.equal(decision.requiresOperatorAction, true);
});

test("EscalationService.decide returns takeover for high risk during execute stage", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "execute" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.requiresOperatorAction, true);
});

test("EscalationService.decide does not return takeover for high risk in non-execute stages", () => {
  const service = new EscalationService();
  const nonExecuteStages: EscalationStage[] = ["assess", "plan", "feedback", "improve", "release"];

  for (const stage of nonExecuteStages) {
    const request = createRequest({ riskLevel: "high", stage });
    const decision = service.decide(request);
    assert.notEqual(decision.decision, "takeover", `Unexpected takeover for stage: ${stage}`);
  }
});

test("EscalationService.decide returns approval for production impact without critical risk", () => {
  const service = new EscalationService();
  const request = createRequest({ affectsProduction: true, riskLevel: "medium" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.equal(decision.requiresOperatorAction, true);
});

test("EscalationService.decide returns approval when estimatedCostUsd >= threshold", () => {
  const service = new EscalationService();
  const request = createRequest({ estimatedCostUsd: 10 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

test("EscalationService.decide uses custom costThresholdUsd when provided", () => {
  const service = new EscalationService();
  const request = createRequest({ estimatedCostUsd: 5, costThresholdUsd: 5 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

test("EscalationService.decide returns approval for high risk in non-execute stages", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "plan" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

test("EscalationService.decide returns none for low risk non-production low cost request", () => {
  const service = new EscalationService();
  const request = createRequest({
    riskLevel: "low",
    affectsProduction: false,
    estimatedCostUsd: 0,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
  assert.equal(decision.reasonCode, "escalation.not_required");
  assert.equal(decision.requiresOperatorAction, false);
});

test("EscalationService.decide handles all risk levels correctly", () => {
  const service = new EscalationService();
  const riskLevels: EscalationRiskLevel[] = ["low", "medium", "high", "critical"];

  for (const riskLevel of riskLevels) {
    const request = createRequest({
      riskLevel,
      affectsProduction: false,
      estimatedCostUsd: 0,
      stage: "assess",
    });
    const decision = service.decide(request);

    if (riskLevel === "critical") {
      assert.equal(decision.decision, "takeover", `Failed for riskLevel: ${riskLevel}`);
    } else if (riskLevel === "high") {
      assert.equal(decision.decision, "approval", `Failed for riskLevel: ${riskLevel}`);
    } else {
      assert.equal(decision.decision, "none", `Failed for riskLevel: ${riskLevel}`);
    }
  }
});

test("EscalationService.decide handles all stages for low risk", () => {
  const service = new EscalationService();
  const stages: EscalationStage[] = ["assess", "plan", "execute", "feedback", "improve", "release"];

  for (const stage of stages) {
    const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 0, stage });
    const decision = service.decide(request);
    assert.equal(decision.decision, "none", `Failed for stage: ${stage}`);
  }
});

test("EscalationService.decide handles null executionId", () => {
  const service = new EscalationService();
  const request = createRequest({ executionId: null });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
});

test("EscalationService.decide handles null tenantId", () => {
  const service = new EscalationService();
  const request = createRequest({ tenantId: null });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
});

test("EscalationService.decide treats null estimatedCostUsd as 0", () => {
  const service = new EscalationService();
  const request = createRequest({ estimatedCostUsd: null, affectsProduction: false, riskLevel: "low" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
});

test("EscalationService.triggerPanicStop returns panic_stop decision with directiveId", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.triggerPanicStop(request);

  assert.equal(decision.decision, "panic_stop");
  assert.ok(decision.panicDirectiveId);
  assert.equal(decision.requiresOperatorAction, true);
});

test("EscalationService.triggerPanicStop includes reason code", () => {
  const service = new EscalationService();
  const request = createRequest({
    riskLevel: "critical",
    affectsProduction: true,
    reasonCode: "test.critical_failure",
  });
  const decision = service.triggerPanicStop(request);

  assert.ok(decision.reasonCode.includes("test.critical_failure"));
});

test("EscalationService.buildPanicScope uses tenantId when present", () => {
  const service = new EscalationService();
  const request = createRequest({ tenantId: "tenant-abc" });
  const decision = service.triggerPanicStop(request);

  assert.ok(decision.panicDirectiveId);
});

test("EscalationService.buildPanicScope uses platform scope when no tenantId", () => {
  const service = new EscalationService();
  const request = createRequest({ tenantId: null });
  const decision = service.triggerPanicStop(request);

  assert.ok(decision.panicDirectiveId);
});

test("EscalationRiskLevel type accepts all valid values", () => {
  const levels: EscalationRiskLevel[] = ["low", "medium", "high", "critical"];
  for (const level of levels) {
    assert.ok(["low", "medium", "high", "critical"].includes(level));
  }
});

test("EscalationStage type accepts all valid values", () => {
  const stages: EscalationStage[] = ["assess", "plan", "execute", "feedback", "improve", "release"];
  for (const stage of stages) {
    assert.ok(["assess", "plan", "execute", "feedback", "improve", "release"].includes(stage));
  }
});

test("EscalationDecisionType type accepts all valid values", () => {
  const decisions: EscalationDecisionType[] = ["none", "approval", "takeover", "panic_stop"];
  for (const decision of decisions) {
    assert.ok(["none", "approval", "takeover", "panic_stop"].includes(decision));
  }
});

test("EscalationService decision priority: panic_stop > takeover > approval > none", () => {
  const service = new EscalationService();
  // critical production should be panic_stop, not takeover
  const request1 = createRequest({ riskLevel: "critical", affectsProduction: true, stage: "execute" });
  const decision1 = service.decide(request1);
  assert.equal(decision1.decision, "panic_stop");

  // critical non-production should be takeover, not approval
  const request2 = createRequest({ riskLevel: "critical", affectsProduction: false, stage: "execute" });
  const decision2 = service.decide(request2);
  assert.equal(decision2.decision, "takeover");

  // high + execute should be takeover, not approval
  const request3 = createRequest({ riskLevel: "high", stage: "execute", affectsProduction: true });
  const decision3 = service.decide(request3);
  assert.equal(decision3.decision, "takeover");
});

test("EscalationService approval triggers for production even with low risk", () => {
  const service = new EscalationService();
  const request = createRequest({ affectsProduction: true, riskLevel: "low" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});