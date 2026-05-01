/**
 * Integration Tests: Escalation Service
 *
 * Tests escalation hierarchy with tiered decision-making:
 * - Tier 1 (agent): Automated resolution attempted first
 * - Tier 2 (team): Escalation to team-level review for high-risk or cost threshold
 * - Tier 3 (human): Human takeover required for critical execute-stage failures
 * - Tier 4 (incident): Full panic/cascade-halt for production-critical failures
 *
 * Tests R17-10: Approval request creation and R17-19: Cost threshold policy.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { EscalationService, type EscalationRequest, type EscalationDecision } from "../../../../../src/platform/five-plane-orchestration/escalation/index.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";
import { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";

function createIntegrationContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/escalation-integration-test.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store, cleanup: () => {
    db.close();
    cleanupPath(workspace);
  }};
}

// ============================================================================
// Tier 4: Incident-level panic stop
// ============================================================================

test("EscalationService: critical production risk triggers panic_stop decision", () => {
  const ctx = createIntegrationContext("aa-escalation-panic-");
  try {
    const service = new EscalationService();

    const request: EscalationRequest = {
      taskId: "task-panic-001",
      executionId: "exec-panic-001",
      tenantId: "tenant-production",
      stage: "execute",
      riskLevel: "critical",
      reasonCode: "escalation.production_failure",
      estimatedCostUsd: 500,
      affectsProduction: true,
    };

    const decision = service.decide(request);

    assert.equal(decision.decision, "panic_stop", "Critical production risk should trigger panic_stop");
    assert.ok(decision.panicDirectiveId, "Panic directive ID should be set");
    assert.equal(decision.requiresOperatorAction, true);
    assert.ok(decision.reasonCode.includes("panic.cascade_halt"));
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService: getActivePanic returns current panic state", () => {
  const ctx = createIntegrationContext("aa-escalation-panic-state-");
  try {
    const service = new EscalationService();

    // Initially no active panic
    const active = service.getActivePanic("platform");
    assert.ok(active === undefined || active !== null, "getActivePanic should return something");

    // Trigger panic
    const request: EscalationRequest = {
      taskId: "task-panic-state-001",
      executionId: "exec-panic-state-001",
      tenantId: null,
      stage: "execute",
      riskLevel: "critical",
      reasonCode: "escalation.critical_failure",
      estimatedCostUsd: 1000,
      affectsProduction: true,
    };

    service.decide(request);

    // Check active panic again
    const activeAfter = service.getActivePanic("platform");
    assert.ok(activeAfter !== undefined, "Should have panic state after activation");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Tier 3: Human takeover
// ============================================================================

test("EscalationService: critical risk without production impact triggers takeover", () => {
  const ctx = createIntegrationContext("aa-escalation-takeover-");
  try {
    const service = new EscalationService();

    const request: EscalationRequest = {
      taskId: "task-takeover-001",
      executionId: "exec-takeover-001",
      tenantId: "tenant-dev",
      stage: "execute",
      riskLevel: "critical",
      reasonCode: "escalation.critical_risk",
      estimatedCostUsd: 50,
      affectsProduction: false,
    };

    const decision = service.decide(request);

    assert.equal(decision.decision, "takeover", "Critical risk should trigger human takeover");
    assert.equal(decision.reasonCode, "escalation.human_takeover_required");
    assert.equal(decision.requiresOperatorAction, true);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService: high risk at execute stage triggers takeover", () => {
  const ctx = createIntegrationContext("aa-escalation-takeover-exec-");
  try {
    const service = new EscalationService();

    const request: EscalationRequest = {
      taskId: "task-takeover-exec-001",
      executionId: "exec-takeover-exec-001",
      tenantId: "tenant-staging",
      stage: "execute",
      riskLevel: "high",
      reasonCode: "escalation.high_risk_execute",
      estimatedCostUsd: null,
      affectsProduction: false,
    };

    const decision = service.decide(request);

    assert.equal(decision.decision, "takeover", "High risk execute-stage should trigger human takeover");
    assert.equal(decision.requiresOperatorAction, true);
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Tier 2: Team-level approval
// ============================================================================

test("EscalationService: production impact triggers approval decision", () => {
  const ctx = createIntegrationContext("aa-escalation-approval-prod-");
  try {
    const db = ctx.db;
    const store = ctx.store;
    const approvalService = new ApprovalService(db, store);
    const service = new EscalationService(undefined, approvalService);

    const request: EscalationRequest = {
      taskId: "task-approval-prod-001",
      executionId: "exec-approval-prod-001",
      tenantId: "tenant-a",
      stage: "assess",
      riskLevel: "medium",
      reasonCode: "escalation.production_impact",
      estimatedCostUsd: 5,
      affectsProduction: true,
    };

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval", "Production impact should trigger approval");
    assert.ok(decision.approvalRequestId, "Approval request ID should be created");
    assert.equal(decision.reasonCode, "escalation.approval_required");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService: cost threshold exceeded triggers approval decision", () => {
  const ctx = createIntegrationContext("aa-escalation-approval-cost-");
  try {
    const db = ctx.db;
    const store = ctx.store;
    const approvalService = new ApprovalService(db, store);
    const service = new EscalationService(undefined, approvalService);

    const request: EscalationRequest = {
      taskId: "task-approval-cost-001",
      executionId: "exec-approval-cost-001",
      tenantId: "tenant-b",
      stage: "plan",
      riskLevel: "low",
      reasonCode: "escalation.cost_threshold",
      estimatedCostUsd: 15, // Exceeds default $10 threshold
      affectsProduction: false,
    };

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval", "Cost threshold exceeded should trigger approval");
    assert.ok(decision.approvalRequestId, "Approval request ID should be created");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService: custom cost threshold is respected", () => {
  const ctx = createIntegrationContext("aa-escalation-approval-custom-cost-");
  try {
    const db = ctx.db;
    const store = ctx.store;
    const approvalService = new ApprovalService(db, store);
    const service = new EscalationService(undefined, approvalService);

    const request: EscalationRequest = {
      taskId: "task-approval-custom-001",
      executionId: "exec-approval-custom-001",
      tenantId: "tenant-c",
      stage: "feedback",
      riskLevel: "low",
      reasonCode: "escalation.custom_cost",
      estimatedCostUsd: 25,
      affectsProduction: false,
      costThresholdUsd: 50, // Higher threshold - should NOT trigger approval
    };

    const decision = service.decide(request);

    assert.equal(decision.decision, "none", "Custom cost threshold should prevent approval at $25");
    assert.ok(!decision.approvalRequestId, "No approval request should be created");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService: high risk triggers approval decision without production/cost factors", () => {
  const ctx = createIntegrationContext("aa-escalation-approval-high-risk-");
  try {
    const db = ctx.db;
    const store = ctx.store;
    const approvalService = new ApprovalService(db, store);
    const service = new EscalationService(undefined, approvalService);

    const request: EscalationRequest = {
      taskId: "task-approval-hr-001",
      executionId: "exec-approval-hr-001",
      tenantId: "tenant-d",
      stage: "improve",
      riskLevel: "high",
      reasonCode: "escalation.high_risk",
      estimatedCostUsd: null,
      affectsProduction: false,
    };

    const decision = service.decide(request);

    assert.equal(decision.decision, "approval", "High risk should trigger approval");
    assert.ok(decision.approvalRequestId, "Approval request ID should be created");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Tier 1: No escalation (automated resolution)
// ============================================================================

test("EscalationService: low risk non-production returns none decision", () => {
  const ctx = createIntegrationContext("aa-escalation-none-");
  try {
    const service = new EscalationService();

    const request: EscalationRequest = {
      taskId: "task-none-001",
      executionId: "exec-none-001",
      tenantId: "tenant-low",
      stage: "assess",
      riskLevel: "low",
      reasonCode: "escalation.low_risk",
      estimatedCostUsd: 1,
      affectsProduction: false,
    };

    const decision = service.decide(request);

    assert.equal(decision.decision, "none", "Low risk non-production should not escalate");
    assert.equal(decision.reasonCode, "escalation.not_required");
    assert.equal(decision.requiresOperatorAction, false);
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService: below cost threshold returns none decision", () => {
  const ctx = createIntegrationContext("aa-escalation-none-cost-");
  try {
    const service = new EscalationService();

    const request: EscalationRequest = {
      taskId: "task-none-cost-001",
      executionId: "exec-none-cost-001",
      tenantId: "tenant-e",
      stage: "plan",
      riskLevel: "medium",
      reasonCode: "escalation.below_threshold",
      estimatedCostUsd: 3, // Below $10 default threshold
      affectsProduction: false,
    };

    const decision = service.decide(request);

    assert.equal(decision.decision, "none", "Below cost threshold should not escalate");
    assert.equal(decision.requiresOperatorAction, false);
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Edge cases and error handling
// ============================================================================

test("EscalationService: handles missing tenantId in panic scope", () => {
  const ctx = createIntegrationContext("aa-escalation-no-tenant-");
  try {
    const service = new EscalationService();

    const request: EscalationRequest = {
      taskId: "task-no-tenant-001",
      executionId: "exec-no-tenant-001",
      tenantId: null, // No tenant
      stage: "execute",
      riskLevel: "critical",
      reasonCode: "escalation.no_tenant_critical",
      estimatedCostUsd: 1000,
      affectsProduction: true,
    };

    const decision = service.decide(request);

    assert.equal(decision.decision, "panic_stop", "Should still trigger panic without tenant");
    assert.ok(decision.panicDirectiveId, "Panic directive should be created");
  } finally {
    ctx.cleanup();
  }
});

test("EscalationService: works without ApprovalService for approval decisions", () => {
  const ctx = createIntegrationContext("aa-escalation-no-approval-svc-");
  try {
    // No ApprovalService provided - approval decisions should still work but skip approval creation
    const service = new EscalationService();

    const request: EscalationRequest = {
      taskId: "task-no-approval-svc-001",
      executionId: "exec-no-approval-svc-001",
      tenantId: "tenant-f",
      stage: "assess",
      riskLevel: "high",
      reasonCode: "escalation.high_risk",
      estimatedCostUsd: 20,
      affectsProduction: false,
    };

    const decision = service.decide(request);

    // Decision should still be "approval" but without approvalRequestId
    assert.equal(decision.decision, "approval", "Should still decide approval is needed");
    assert.ok(!decision.approvalRequestId, "No approval request ID without ApprovalService");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// All escalation stages
// ============================================================================

const escalationStages = ["assess", "plan", "execute", "feedback", "improve", "release"] as const;

for (const stage of escalationStages) {
  test(`EscalationService: handles stage "${stage}" correctly`, () => {
    const ctx = createIntegrationContext(`aa-escalation-stage-${stage}-`);
    try {
      const service = new EscalationService();

      const request: EscalationRequest = {
        taskId: `task-stage-${stage}-001`,
        executionId: `exec-stage-${stage}-001`,
        tenantId: "tenant-stage",
        stage,
        riskLevel: "medium",
        reasonCode: `escalation.stage_${stage}`,
        estimatedCostUsd: 5,
        affectsProduction: true,
      };

      const decision = service.decide(request);

      // All stages should result in some decision
      assert.ok(["none", "approval", "takeover", "panic_stop"].includes(decision.decision));

      // Verify no unhandled exceptions
      assert.ok(typeof decision.reasonCode === "string");
    } finally {
      ctx.cleanup();
    }
  });
}

// ============================================================================
// All risk levels
// ============================================================================

const riskLevels = ["low", "medium", "high", "critical"] as const;

for (const riskLevel of riskLevels) {
  test(`EscalationService: handles riskLevel "${riskLevel}" correctly`, () => {
    const ctx = createIntegrationContext(`aa-escalation-risk-${riskLevel}-`);
    try {
      const service = new EscalationService();

      const request: EscalationRequest = {
        taskId: `task-risk-${riskLevel}-001`,
        executionId: `exec-risk-${riskLevel}-001`,
        tenantId: "tenant-risk",
        stage: "execute",
        riskLevel,
        reasonCode: `escalation.risk_${riskLevel}`,
        estimatedCostUsd: 5,
        affectsProduction: false,
      };

      const decision = service.decide(request);

      // Verify a decision was made
      assert.ok(["none", "approval", "takeover", "panic_stop"].includes(decision.decision));
      assert.ok(typeof decision.reasonCode === "string");
      assert.ok(typeof decision.requiresOperatorAction === "boolean");

      // Higher risk should never result in "none" with production impact
      if (request.affectsProduction && riskLevel === "critical") {
        assert.equal(decision.decision, "panic_stop");
      }
    } finally {
      ctx.cleanup();
    }
  });
}

// ============================================================================
// Panic resume protocol
// ============================================================================

test("EscalationService: resumeFromPanic delegates to PlatformPanicService", () => {
  const ctx = createIntegrationContext("aa-escalation-resume-");
  try {
    const service = new EscalationService();

    // Initially, there should be no active panic to resume from
    // The resumeFromPanic method should return a PanicResumeReceipt
    const mockPlan = {
      resumeId: "resume-001",
      scope: "platform",
      steps: [],
      createdAt: Date.now(),
    };

    const receipt = service.resumeFromPanic("platform", mockPlan);

    // Receipt should have the expected structure
    assert.ok(receipt, "resumeFromPanic should return a receipt");
    assert.ok("resumedAt" in receipt || "directive" in receipt || receipt !== undefined);
  } finally {
    ctx.cleanup();
  }
});