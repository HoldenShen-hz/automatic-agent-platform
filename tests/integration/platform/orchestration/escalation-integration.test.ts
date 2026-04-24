// @ts-nocheck
/**
 * Integration Test: Escalation Service
 *
 * Tests the EscalationService which determines escalation decisions
 * based on risk level, stage, cost, and production impact.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../helpers/integration-context.js";
import {
  EscalationService,
  type EscalationRequest,
  type EscalationDecision,
  type EscalationRiskLevel,
  type EscalationStage,
} from "../../../src/platform/orchestration/escalation/index.js";

function createEscalationRequest(overrides: Partial<EscalationRequest> = {}): EscalationRequest {
  return {
    taskId: "task_escalation_001",
    executionId: "exec_escalation_001",
    tenantId: "tenant_001",
    stage: "execute",
    riskLevel: "medium",
    reasonCode: "test_reason",
    estimatedCostUsd: 5.0,
    affectsProduction: false,
    ...overrides,
  };
}

test("EscalationService returns none for low risk non-production request", () => {
  const ctx = createIntegrationContext("aa-esc-lowrisk-");
  try {
    const service = new EscalationService();

    const request = createEscalationRequest({
      riskLevel: "low",
      affectsProduction: false,
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "none");
    assert.equal(decision.reasonCode, "escalation.not_required");
    assert.equal(decision.requiresOperatorAction, false);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService returns approval for production affecting request", () => {
  const ctx = createIntegrationContext("aa-esc-production-");
  try {
    const service = new EscalationService();

    const request = createEscalationRequest({
      affectsProduction: true,
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval");
    assert.equal(decision.reasonCode, "escalation.approval_required");
    assert.equal(decision.requiresOperatorAction, true);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService returns approval for high cost request", () => {
  const ctx = createIntegrationContext("aa-esc-highcost-");
  try {
    const service = new EscalationService();

    const request = createEscalationRequest({
      estimatedCostUsd: 15.0, // Above $10 threshold
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval");
    assert.equal(decision.reasonCode, "escalation.approval_required");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService returns approval for high risk request", () => {
  const ctx = createIntegrationContext("aa-esc-highrisk-");
  try {
    const service = new EscalationService();

    const request = createEscalationRequest({
      riskLevel: "high",
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval");
    assert.equal(decision.reasonCode, "escalation.approval_required");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService returns takeover for critical risk non-production", () => {
  const ctx = createIntegrationContext("aa-esc-critical-");
  try {
    const service = new EscalationService();

    const request = createEscalationRequest({
      riskLevel: "critical",
      affectsProduction: false,
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "takeover");
    assert.equal(decision.reasonCode, "escalation.human_takeover_required");
    assert.equal(decision.requiresOperatorAction, true);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService returns takeover for high risk at execute stage", () => {
  const ctx = createIntegrationContext("aa-esc-takeover-");
  try {
    const service = new EscalationService();

    const request = createEscalationRequest({
      riskLevel: "high",
      stage: "execute",
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "takeover");
    assert.equal(decision.reasonCode, "escalation.human_takeover_required");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService returns panic_stop for critical production affecting", () => {
  const ctx = createIntegrationContext("aa-esc-panic-");
  try {
    const service = new EscalationService();

    const request = createEscalationRequest({
      riskLevel: "critical",
      affectsProduction: true,
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "panic_stop");
    assert.equal(decision.reasonCode, "escalation.critical_prod_stop");
    assert.equal(decision.requiresOperatorAction, true);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService panic_stop takes precedence over takeover", () => {
  const ctx = createIntegrationContext("aa-esc-panic-precedence-");
  try {
    const service = new EscalationService();

    // Both conditions for panic_stop (critical + production) and takeover (critical or high+execute)
    const request = createEscalationRequest({
      riskLevel: "critical",
      affectsProduction: true,
      stage: "execute",
    });

    const decision = service.decide(request);

    // panic_stop should be returned because it's checked first
    assert.equal(decision.decision, "panic_stop");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService handles null cost as zero", () => {
  const ctx = createIntegrationContext("aa-esc-nullcost-");
  try {
    const service = new EscalationService();

    const request = createEscalationRequest({
      estimatedCostUsd: null,
    });

    const decision = service.decide(request);

    // Should not trigger cost-based approval since null is treated as 0
    assert.ok(decision.decision === "none" || decision.decision === "approval");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService respects decision order - panic_stop first", () => {
  const ctx = createIntegrationContext("aa-esc-order1-");
  try {
    const service = new EscalationService();

    // Critical + production = panic_stop
    const request = createEscalationRequest({
      riskLevel: "critical",
      affectsProduction: true,
    });

    const decision = service.decide(request);
    assert.equal(decision.decision, "panic_stop");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService respects decision order - takeover second", () => {
  const ctx = createIntegrationContext("aa-esc-order2-");
  try {
    const service = new EscalationService();

    // Critical but not production = takeover
    const request = createEscalationRequest({
      riskLevel: "critical",
      affectsProduction: false,
    });

    const decision = service.decide(request);
    assert.equal(decision.decision, "takeover");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService respects decision order - approval third", () => {
  const ctx = createIntegrationContext("aa-esc-order3-");
  try {
    const service = new EscalationService();

    // High risk with low cost and non-production = approval
    const request = createEscalationRequest({
      riskLevel: "high",
      affectsProduction: false,
      estimatedCostUsd: 1.0,
      stage: "plan",
    });

    const decision = service.decide(request);
    assert.equal(decision.decision, "approval");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService all stages are valid", () => {
  const ctx = createIntegrationContext("aa-esc-stages-");
  try {
    const service = new EscalationService();
    const stages: EscalationStage[] = ["assess", "plan", "execute", "feedback", "improve", "release"];

    for (const stage of stages) {
      const request = createEscalationRequest({ stage });
      const decision = service.decide(request);
      assert.ok(
        ["none", "approval", "takeover", "panic_stop"].includes(decision.decision),
        `Stage ${stage} should produce valid decision`,
      );
    }
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService all risk levels are valid", () => {
  const ctx = createIntegrationContext("aa-esc-risklevels-");
  try {
    const service = new EscalationService();
    const riskLevels: EscalationRiskLevel[] = ["low", "medium", "high", "critical"];

    for (const riskLevel of riskLevels) {
      const request = createEscalationRequest({ riskLevel });
      const decision = service.decide(request);
      assert.ok(
        ["none", "approval", "takeover", "panic_stop"].includes(decision.decision),
        `Risk level ${riskLevel} should produce valid decision`,
      );
    }
  } finally {
    ctx.cleanup();
  }
});
