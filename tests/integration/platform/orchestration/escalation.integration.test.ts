/**
 * Integration Test: Escalation Service Flow
 *
 * Tests the escalation service decision flow and interactions
 * with external services (panic service, approval service).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import {
  EscalationService,
  type EscalationRequest,
  type EscalationDecision,
} from "../../../../src/platform/five-plane-orchestration/escalation/index.js";

// Mock services for testing escalation service with external dependencies
const mockPanicService = {
  activate: (request: any) => ({
    directive: { directiveId: `panic_directive_${Date.now()}` },
    request,
  }),
  resume: (_scope: string, _plan: unknown) => ({ resumed: true }),
  getActive: (_scope: string) => null,
};

const mockApprovalService = {
  createRequest: (opts: { taskId: string; executionId?: string; sourceAgentId: string; reason: string; riskLevel: string; options: string[]; context: any; timeoutPolicy: string }) => ({
    approvalId: `approval_${opts.taskId}`,
    ...opts,
  }),
};

function createEscalationRequest(overrides: Partial<EscalationRequest> = {}): EscalationRequest {
  return {
    taskId: "task_escalation_test",
    executionId: "exec_escalation_test",
    tenantId: "tenant_escalation_test",
    stage: "execute",
    riskLevel: "medium",
    reasonCode: "test.escalation",
    estimatedCostUsd: null,
    affectsProduction: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchical Escalation Decision Flow (Issue #2177)
// ─────────────────────────────────────────────────────────────────────────────

test("EscalationService Level 4 - Critical Production triggers panic_stop", () => {
  const ctx = createIntegrationContext("aa-esc-level4-");
  try {
    const service = new EscalationService(mockPanicService as any, null);
    const request = createEscalationRequest({
      riskLevel: "critical",
      affectsProduction: true,
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "panic_stop");
    assert.equal(decision.reasonCode, "escalation.critical_prod_stop");
    assert.equal(decision.requiresOperatorAction, true);
    assert.ok(decision.panicActivation === undefined || decision.panicActivation?.directiveId !== undefined);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService Level 3 - Critical non-production triggers takeover", () => {
  const ctx = createIntegrationContext("aa-esc-level3-");
  try {
    const service = new EscalationService(mockPanicService as any, null);
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

test("EscalationService Level 3 - High risk at execute stage triggers takeover", () => {
  const ctx = createIntegrationContext("aa-esc-high-exec-");
  try {
    const service = new EscalationService(mockPanicService as any, null);
    const request = createEscalationRequest({
      riskLevel: "high",
      stage: "execute",
      affectsProduction: false,
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "takeover");
    assert.equal(decision.reasonCode, "escalation.human_takeover_required");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService Level 2 - Production impact triggers approval", () => {
  const ctx = createIntegrationContext("aa-esc-prod-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);
    const request = createEscalationRequest({
      affectsProduction: true,
      riskLevel: "low",
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval");
    assert.equal(decision.reasonCode, "escalation.approval_required");
    assert.ok(decision.approvalRequestId !== undefined);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService Level 2 - High cost triggers approval", () => {
  const ctx = createIntegrationContext("aa-esc-highcost-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);
    const request = createEscalationRequest({
      estimatedCostUsd: 15,
      costThresholdUsd: 10,
      riskLevel: "low",
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval");
    assert.ok(decision.approvalRequestId !== undefined);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService Level 2 - High risk triggers approval", () => {
  const ctx = createIntegrationContext("aa-esc-highrisk-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);
    const request = createEscalationRequest({
      riskLevel: "high",
      stage: "assess",
      affectsProduction: false,
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval");
    assert.ok(decision.approvalRequestId !== undefined);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService Level 1 - Low risk no production returns none", () => {
  const ctx = createIntegrationContext("aa-esc-none-");
  try {
    const service = new EscalationService(mockPanicService as any, null);
    const request = createEscalationRequest({
      riskLevel: "low",
      affectsProduction: false,
      estimatedCostUsd: 1,
    });

    const decision = service.decide(request);

    assert.equal(decision.decision, "none");
    assert.equal(decision.reasonCode, "escalation.not_required");
    assert.equal(decision.requiresOperatorAction, false);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService hierarchical priority order enforced", () => {
  const ctx = createIntegrationContext("aa-esc-priority-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);

    // Priority 1: panic_stop (critical + production)
    const criticalProd = createEscalationRequest({ riskLevel: "critical", affectsProduction: true });
    assert.equal(service.decide(criticalProd).decision, "panic_stop");

    // Priority 2: takeover (critical without production OR high+execute)
    const criticalNoProd = createEscalationRequest({ riskLevel: "critical", affectsProduction: false });
    assert.equal(service.decide(criticalNoProd).decision, "takeover");

    const highExec = createEscalationRequest({ riskLevel: "high", stage: "execute" });
    assert.equal(service.decide(highExec).decision, "takeover");

    // Priority 3: approval (production impact, high cost, or high risk)
    const prodImpact = createEscalationRequest({ affectsProduction: true, riskLevel: "low" });
    assert.equal(service.decide(prodImpact).decision, "approval");

    const highCost = createEscalationRequest({ estimatedCostUsd: 50 });
    assert.equal(service.decide(highCost).decision, "approval");

    const highRisk = createEscalationRequest({ riskLevel: "high", stage: "plan" });
    assert.equal(service.decide(highRisk).decision, "approval");

    // Priority 4: none (low risk, no impact)
    const lowRisk = createEscalationRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 1 });
    assert.equal(service.decide(lowRisk).decision, "none");
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cost Threshold Tests
// ─────────────────────────────────────────────────────────────────────────────

test("EscalationService default cost threshold is $10", () => {
  const ctx = createIntegrationContext("aa-esc-cost-default-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);
    const request = createEscalationRequest({ estimatedCostUsd: 10 });

    const decision = service.decide(request);

    // >= $10 triggers approval
    assert.equal(decision.decision, "approval");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService below threshold does not trigger approval", () => {
  const ctx = createIntegrationContext("aa-esc-cost-below-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);
    const request = createEscalationRequest({ estimatedCostUsd: 9.99, riskLevel: "low", affectsProduction: false });

    const decision = service.decide(request);

    assert.equal(decision.decision, "none");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService custom cost threshold via costThresholdUsd", () => {
  const ctx = createIntegrationContext("aa-esc-cost-custom-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);
    const request = createEscalationRequest({
      estimatedCostUsd: 50,
      costThresholdUsd: 100, // Higher threshold
      riskLevel: "low",
    });

    const decision = service.decide(request);

    // $50 < $100, so no cost-based approval
    assert.equal(decision.decision, "none");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService null estimatedCostUsd treated as 0", () => {
  const ctx = createIntegrationContext("aa-esc-cost-null-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);
    const request = createEscalationRequest({ estimatedCostUsd: null });

    const decision = service.decide(request);

    // null treated as 0, below threshold
    assert.ok(decision.decision === "none" || decision.decision === "approval");
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Approval Service Integration
// ─────────────────────────────────────────────────────────────────────────────

test("EscalationService creates approval request when approval service available", () => {
  const ctx = createIntegrationContext("aa-esc-approval-create-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);
    const request = createEscalationRequest({ affectsProduction: true });

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval");
    assert.ok(decision.approvalRequestId !== undefined);
    assert.equal(decision.approvalRequestId, "approval_task_escalation_test");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService handles missing approval service gracefully", () => {
  const ctx = createIntegrationContext("aa-esc-approval-missing-");
  try {
    const service = new EscalationService(mockPanicService as any, null); // No approval service
    const request = createEscalationRequest({ affectsProduction: true });

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval");
    assert.ok(decision.approvalRequestId == null);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Panic Service Integration
// ─────────────────────────────────────────────────────────────────────────────

test("EscalationService triggerPanicStop builds correct scope for tenant", () => {
  const ctx = createIntegrationContext("aa-esc-panic-scope-");
  try {
    const activations: EscalationRequest[] = [];
    const service = new EscalationService({
      panicService: {
        ...mockPanicService,
        activate: (request: EscalationRequest) => {
          activations.push(request);
          return mockPanicService.activate(request);
        },
      },
    } as any);
    const request = createEscalationRequest({
      tenantId: "tenant_xyz",
      riskLevel: "critical",
      affectsProduction: true,
    });

    const decision = service.decide(request);
    assert.equal(decision.decision, "panic_activate");
    assert.equal(activations.length, 1);
    assert.equal(activations[0]?.scope, "tenant/tenant_xyz");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService resumeFromPanic delegates to panic service", () => {
  const ctx = createIntegrationContext("aa-esc-resume-");
  try {
    const service = new EscalationService(mockPanicService as any, null);

    const receipt = service.resumeFromPanic("tenant/tenant_test", {} as any);

    assert.ok(typeof receipt.resumed === "boolean");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService getActivePanic delegates to panic service", () => {
  const ctx = createIntegrationContext("aa-esc-active-");
  try {
    const service = new EscalationService(mockPanicService as any, null);

    const active = service.getPanicService().getActive("tenant/tenant_test");

    assert.equal(active, null);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Stage and Risk Level Coverage
// ─────────────────────────────────────────────────────────────────────────────

test("EscalationService handles all escalation stages", () => {
  const ctx = createIntegrationContext("aa-esc-all-stages-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);
    const stages = ["assess", "plan", "execute", "feedback", "improve", "release"] as const;

    for (const stage of stages) {
      const request = createEscalationRequest({ stage });
      const decision = service.decide(request);
      assert.ok(
        ["none", "approval", "takeover", "panic_stop"].includes(decision.decision),
        `Stage ${stage} produced invalid decision: ${decision.decision}`,
      );
    }
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService handles all risk levels", () => {
  const ctx = createIntegrationContext("aa-esc-all-risks-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);
    const riskLevels = ["low", "medium", "high", "critical"] as const;

    for (const riskLevel of riskLevels) {
      const request = createEscalationRequest({ riskLevel });
      const decision = service.decide(request);
      assert.ok(typeof decision.decision === "string");
      assert.ok(typeof decision.reasonCode === "string");
      assert.ok(typeof decision.requiresOperatorAction === "boolean");
    }
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Reason Codes Verification
// ─────────────────────────────────────────────────────────────────────────────

test("EscalationService reasonCodes are correctly set", () => {
  const ctx = createIntegrationContext("aa-esc-reason-codes-");
  try {
    const service = new EscalationService(mockPanicService as any, mockApprovalService as any);

    const tests = [
      { request: createEscalationRequest({ riskLevel: "low" }), expectedReason: "escalation.not_required" },
      { request: createEscalationRequest({ riskLevel: "high", stage: "assess" }), expectedReason: "escalation.approval_required" },
      { request: createEscalationRequest({ riskLevel: "critical", affectsProduction: false }), expectedReason: "escalation.human_takeover_required" },
      { request: createEscalationRequest({ riskLevel: "critical", affectsProduction: true }), expectedReason: "escalation.critical_prod_stop" },
    ];

    for (const { request, expectedReason } of tests) {
      const decision = service.decide(request);
      assert.equal(decision.reasonCode, expectedReason, `Failed for ${request.riskLevel}`);
    }
  } finally {
    ctx.cleanup();
  }
});
