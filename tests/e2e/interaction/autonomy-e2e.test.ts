/**
 * E2E Autonomy Service Tests
 *
 * End-to-end tests covering autonomy service:
 * 1. Autonomy level transitions
 * 2. Escalation handling
 * 3. Audit trail for autonomy decisions
 * 4. Boundary enforcement
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { AutonomyService } from "../../../src/interaction/autonomy/autonomy-service.js";
import { AutonomyAuditService } from "../../../src/interaction/autonomy/autonomy-audit-service.js";
import type { AutonomyDecision } from "../../../src/interaction/autonomy/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createAutonomyDecision(overrides: Partial<AutonomyDecision> = {}): AutonomyDecision {
  return {
    decisionId: overrides.decisionId ?? "dec_e2e_001",
    taskId: overrides.taskId ?? "task_e2e_001",
    level: overrides.level ?? "semi_auto",
    reason: overrides.reason ?? "Normal operation",
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    actor: overrides.actor ?? "system",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Autonomy Service Level Management
// ---------------------------------------------------------------------------

test("E2E Autonomy: AutonomyService determines correct level for task", async () => {
  const harness = createE2EHarness("aa-e2e-autonomy-");
  try {
    const service = new AutonomyService();

    const decision = service.determineLevel({
      taskId: "task_e2e_001",
      taskType: "code_generation",
      riskScore: 30,
      userId: "user_e2e_001",
    });

    assert.ok(decision, "Should return autonomy decision");
    assert.ok(decision.level, "Should have autonomy level");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Autonomy Level Transition
// ---------------------------------------------------------------------------

test("E2E Autonomy: Service handles transition from auto to manual", async () => {
  const harness = createE2EHarness("aa-e2e-autonomy-trans-");
  try {
    const service = new AutonomyService();

    // Escalate to higher supervision
    const escalated = service.escalate({
      taskId: "task_e2e_001",
      reason: "Risk threshold exceeded",
      targetLevel: "manual",
    });

    assert.ok(escalated, "Should return escalation result");
    assert.equal(escalated.newLevel, "manual", "Should transition to manual");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Autonomy Audit Trail
// ---------------------------------------------------------------------------

test("E2E Autonomy: AutonomyAuditService records all autonomy decisions", async () => {
  const harness = createE2EHarness("aa-e2e-autonomy-audit-");
  try {
    const auditService = new AutonomyAuditService();

    auditService.recordChange({
      eventType: "agent.autonomy.promoted",
      agentId: "agent_e2e_001",
      capabilityId: "code_generation",
      fromLevel: "semi_auto",
      toLevel: "full_auto",
      trigger: "rule_engine",
      approvedBy: "auto",
      evidence: {
        successRate: 0.98,
        totalExecutions: 50,
        incidentCount: 0,
        evaluationWindow: "30d",
      },
    });

    const trail = auditService.getByAgent("agent_e2e_001");
    assert.ok(Array.isArray(trail), "Should return audit trail");
    assert.equal(trail.length, 1, "Should record one autonomy change");
  } finally {
    harness.cleanup();
  }
});
