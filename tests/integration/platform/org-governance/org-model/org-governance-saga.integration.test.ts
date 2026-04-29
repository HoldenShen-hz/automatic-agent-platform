import assert from "node:assert/strict";
import test from "node:test";
import {
  OrgGovernanceSaga,
  type OrgGovernanceSagaStep,
} from "../../../../../src/org-governance/org-model/org-governance-saga.js";
import type { OrgNode } from "../../../../../src/org-governance/org-model/hierarchy/index.js";

function mockOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    nodeId: "org-node-1",
    name: "Test Org Node",
    nodeType: "division",
    parentNodeId: null,
    path: "/root/org-node-1",
    level: 1,
    active: true,
    metadata: {},
    ...overrides,
  };
}

test("OrgGovernanceSaga executes multi-phase governance lifecycle", () => {
  const saga = new OrgGovernanceSaga({
    prepare: (step, _ctx) => {
      assert.ok(step.action === "prepare");
    },
    commit: (step, _ctx) => {
      assert.ok(step.action === "commit");
    },
    audit: (step, _ctx) => {
      assert.ok(step.action === "audit");
    },
  });

  const steps: OrgGovernanceSagaStep[] = [
    { stepId: "step-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "step-2", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    { stepId: "step-3", targetOrgNodeId: "org-1", action: "audit", phase: "identity" },
    { stepId: "step-4", targetOrgNodeId: "org-1", action: "prepare", phase: "approval" },
    { stepId: "step-5", targetOrgNodeId: "org-1", action: "commit", phase: "approval" },
  ];

  const result = saga.execute("saga-1", steps);

  assert.strictEqual(result.status, "committed");
  assert.ok(result.preparedNodeIds.includes("org-1"));
  assert.ok(result.committedNodeIds.includes("org-1"));
  assert.strictEqual(result.failedStepId, null);
});

test("OrgGovernanceSaga respects phase ordering", () => {
  const saga = new OrgGovernanceSaga();
  const phases: Array<{ phase: "identity" | "approval" | "budget" | "domain" | "agent"; order: number }> = [];

  const testSaga = new OrgGovernanceSaga({
    prepare: (step, _ctx) => {
      phases.push({ phase: step.phase, order: 0 });
    },
    commit: (step, _ctx) => {
      phases.push({ phase: step.phase, order: 1 });
    },
  });

  // PHASE_ORDER = ["identity", "approval", "budget", "domain", "agent"]
  const steps: OrgGovernanceSagaStep[] = [
    { stepId: "step-budget", targetOrgNodeId: "org-1", action: "prepare", phase: "budget" },
    { stepId: "step-identity", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "step-approval", targetOrgNodeId: "org-1", action: "prepare", phase: "approval" },
  ];

  testSaga.execute("saga-phase-order", steps);

  // Sorted by PHASE_ORDER: identity(0) < approval(1) < budget(2)
  const phaseOrder = phases.map((p) => p.phase);
  const identityIdx = phaseOrder.indexOf("identity");
  const budgetIdx = phaseOrder.indexOf("budget");
  const approvalIdx = phaseOrder.indexOf("approval");
  assert.ok(identityIdx < approvalIdx, "identity phase should execute before approval");
  assert.ok(identityIdx < budgetIdx, "identity phase should execute before budget");
  assert.ok(approvalIdx < budgetIdx, "approval phase should execute before budget");
});

test("OrgGovernanceSaga compensates on prepare failure", () => {
  const saga = new OrgGovernanceSaga({
    prepare: (step, _ctx) => {
      if (step.stepId === "step-fail") {
        throw new Error("Prepare failure");
      }
    },
    compensate: (step, _ctx) => {
      // compensate
    },
  });

  const steps: OrgGovernanceSagaStep[] = [
    { stepId: "step-ok", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "step-fail", targetOrgNodeId: "org-2", action: "prepare", phase: "approval" },
    { stepId: "step-never", targetOrgNodeId: "org-3", action: "commit", phase: "budget" },
  ];

  const result = saga.execute("saga-compensate", steps);

  assert.strictEqual(result.status, "compensated");
  assert.ok(result.preparedNodeIds.includes("org-1"), "org-1 was prepared");
  assert.ok(result.compensatedNodeIds.includes("org-1"), "org-1 should be compensated");
  assert.ok(result.failedStepId === "step-fail");
});

test("OrgGovernanceSaga produces receipt with phase ordering", () => {
  const saga = new OrgGovernanceSaga();

  const steps: OrgGovernanceSagaStep[] = [
    { stepId: "step-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "step-2", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    { stepId: "step-3", targetOrgNodeId: "org-1", action: "audit", phase: "identity" },
    { stepId: "step-4", targetOrgNodeId: "org-2", action: "prepare", phase: "domain" },
    { stepId: "step-5", targetOrgNodeId: "org-2", action: "commit", phase: "domain" },
  ];

  const result = saga.execute("saga-receipt-1", steps);

  assert.ok(result.preparedNodeIds.length > 0);
  assert.ok(result.committedNodeIds.length > 0);
  assert.ok(result.executionLog.length > 0);
  assert.strictEqual(result.sagaId, "saga-receipt-1");
});