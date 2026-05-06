import assert from "node:assert/strict";
import test from "node:test";

import {
  EscalationService,
  EscalationRequest,
  EscalationRiskLevel,
  EscalationStage,
} from "../../../../src/platform/orchestration/escalation/index.js";

// Helper to create a minimal valid request
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

// --- panic_stop tests ---

test("decide returns panic_stop when riskLevel is critical and affectsProduction is true", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  assert.equal(decision.decision, "panic_stop");
  assert.equal(decision.reasonCode, "panic.cascade_halt:test.reason");
  assert.equal(decision.requiresOperatorAction, true);
});

test("decide returns panic_stop regardless of stage when critical and production", () => {
  const service = new EscalationService();
  const stages: EscalationStage[] = ["assess", "plan", "execute", "feedback", "improve", "release"];

  for (const stage of stages) {
    const request = createRequest({ riskLevel: "critical", affectsProduction: true, stage });
    const decision = service.decide(request);
    assert.equal(decision.decision, "panic_stop", `Failed for stage: ${stage}`);
  }
});

// --- takeover tests ---

test("decide returns takeover when riskLevel is critical (non-production)", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.reasonCode, "escalation.human_takeover_required");
  assert.equal(decision.requiresOperatorAction, true);
});

test("decide returns takeover when riskLevel is high and stage is execute", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "execute" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.reasonCode, "escalation.human_takeover_required");
  assert.equal(decision.requiresOperatorAction, true);
});

test("decide does not return takeover for high riskLevel in non-execute stages", () => {
  const service = new EscalationService();
  const nonExecuteStages: EscalationStage[] = ["assess", "plan", "feedback", "improve", "release"];

  for (const stage of nonExecuteStages) {
    const request = createRequest({ riskLevel: "high", stage });
    const decision = service.decide(request);
    // Should be approval, not takeover, for high risk in non-execute stages
    assert.notEqual(decision.decision, "takeover", `Unexpected takeover for stage: ${stage}`);
  }
});

// --- approval tests ---

test("decide returns approval when affectsProduction is true (non-critical)", () => {
  const service = new EscalationService();
  const request = createRequest({ affectsProduction: true, riskLevel: "medium" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.equal(decision.reasonCode, "escalation.approval_required");
  assert.equal(decision.requiresOperatorAction, true);
});

test("decide returns approval when estimatedCostUsd is 10 or more", () => {
  const service = new EscalationService();
  const request = createRequest({ estimatedCostUsd: 10 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

test("decide returns approval when estimatedCostUsd exceeds 10", () => {
  const service = new EscalationService();
  const request = createRequest({ estimatedCostUsd: 100 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

test("decide returns approval when estimatedCostUsd is null (treated as 0)", () => {
  const service = new EscalationService();
  const request = createRequest({ estimatedCostUsd: null });
  const decision = service.decide(request);

  // null is treated as 0, so it should not trigger approval by cost alone
  // With low risk, non-production, null cost, it should be "none"
  assert.equal(decision.decision, "none");
});

test("decide returns approval when riskLevel is high (non-critical, non-execute)", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "plan" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

// --- none tests ---

test("decide returns none for low risk, non-production, low cost request", () => {
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

test("decide returns none for medium risk, non-production, low cost request", () => {
  const service = new EscalationService();
  const request = createRequest({
    riskLevel: "medium",
    affectsProduction: false,
    estimatedCostUsd: 5,
    stage: "assess",
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
});

// --- decision priority tests (panic_stop > takeover > approval > none) ---

test("panic_stop takes priority over takeover (critical production)", () => {
  const service = new EscalationService();
  // This is both critical and would trigger takeover (critical = takeover), but panic_stop has priority
  const request = createRequest({ riskLevel: "critical", affectsProduction: true, stage: "execute" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "panic_stop");
});

test("takeover takes priority over approval (critical non-production)", () => {
  const service = new EscalationService();
  // critical would be takeover, but high+execute would also be takeover
  const request = createRequest({ riskLevel: "critical", affectsProduction: false, stage: "execute" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
});

test("approval does not override takeover path", () => {
  const service = new EscalationService();
  // high + execute = takeover (not approval)
  const request = createRequest({
    riskLevel: "high",
    stage: "execute",
    affectsProduction: true, // This would normally trigger approval
  });
  const decision = service.decide(request);

  // takeover should win because high + execute triggers takeover before approval check
  assert.equal(decision.decision, "takeover");
});

// --- all risk levels ---

test("decide handles all risk levels correctly", () => {
  const service = new EscalationService();
  const riskLevels: EscalationRiskLevel[] = ["low", "medium", "high", "critical"];

  for (const riskLevel of riskLevels) {
    // Test with non-production and low cost
    const request = createRequest({ riskLevel, affectsProduction: false, estimatedCostUsd: 0, stage: "assess" });
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

// --- all stages ---

test("decide handles all stages correctly for low risk non-production", () => {
  const service = new EscalationService();
  const stages: EscalationStage[] = ["assess", "plan", "execute", "feedback", "improve", "release"];

  for (const stage of stages) {
    const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 0, stage });
    const decision = service.decide(request);
    assert.equal(decision.decision, "none", `Failed for stage: ${stage}`);
  }
});

test("stage execute triggers takeover for high risk even in non-production", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high", stage: "execute", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
});

// --- null/undefined handling ---

test("decide handles null executionId", () => {
  const service = new EscalationService();
  const request = createRequest({ executionId: null });
  const decision = service.decide(request);

  // Should not affect decision logic
  assert.equal(decision.decision, "none");
});

test("decide handles null tenantId", () => {
  const service = new EscalationService();
  const request = createRequest({ tenantId: null });
  const decision = service.decide(request);

  // Should not affect decision logic
  assert.equal(decision.decision, "none");
});

// --- edge cases ---

test("decide treats estimatedCostUsd null as 0 in comparison", () => {
  const service = new EscalationService();
  // null >= 10 should be false, so cost alone doesn't trigger approval
  const request = createRequest({ estimatedCostUsd: null, affectsProduction: false, riskLevel: "low" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
});

test("decide triggers approval when affectsProduction is true even with low risk", () => {
  const service = new EscalationService();
  const request = createRequest({ affectsProduction: true, riskLevel: "low" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

test("decide triggers approval for high risk regardless of cost and production status", () => {
  const service = new EscalationService();
  const request = createRequest({
    riskLevel: "high",
    affectsProduction: false,
    estimatedCostUsd: 0,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});
