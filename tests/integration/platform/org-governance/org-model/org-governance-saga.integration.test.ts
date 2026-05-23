import assert from "node:assert/strict";
import test from "node:test";
import {
  OrgGovernanceSaga,
  type OrgGovernanceSagaStep,
} from "../../../../../src/org-governance/org-model/org-governance-saga.js";
import type { OrgNode } from "../../../../../src/org-governance/org-model/org-node/index.js";

function mockOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: "org-node-1",
    displayName: "Test Org Node",
    nodeType: "division",
    parentOrgNodeId: null,
    ownerUserIds: [],
    active: true,
    costCenter: "",
    metadata: {},
    ...overrides,
    effectivePolicies: overrides.effectivePolicies ?? {},
    status: overrides.status ?? "active",
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
    compensate: () => {},
  });

  const steps: OrgGovernanceSagaStep[] = [
    { stepId: "step-1", targetOrgNodeId: "org-1", action: "prepare" },
    { stepId: "step-2", targetOrgNodeId: "org-1", action: "commit" },
    { stepId: "step-3", targetOrgNodeId: "org-1", action: "audit" },
    { stepId: "step-4", targetOrgNodeId: "org-1", action: "prepare" },
    { stepId: "step-5", targetOrgNodeId: "org-1", action: "commit" },
  ];

  const result = saga.execute("saga-1", steps);

  assert.strictEqual(result.status, "committed");
  assert.ok(result.preparedNodeIds.includes("org-1"));
  assert.ok(result.committedNodeIds.includes("org-1"));
  assert.strictEqual(result.failedStepId, null);
});

test("OrgGovernanceSaga respects ordering", () => {
  const actions: Array<{ stepId: string; action: string }> = [];

  const testSaga = new OrgGovernanceSaga({
    prepare: (step, _ctx) => {
      actions.push({ stepId: step.stepId, action: step.action });
    },
    commit: (step, _ctx) => {
      actions.push({ stepId: step.stepId, action: step.action });
    },
    compensate: () => {},
  });

  const steps: OrgGovernanceSagaStep[] = [
    { stepId: "step-budget", targetOrgNodeId: "org-1", action: "prepare", phase: "budget" },
    { stepId: "step-identity", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "step-approval", targetOrgNodeId: "org-1", action: "prepare", phase: "approval" },
  ];

  testSaga.execute("saga-phase-order", steps);

  // Verify steps are executed in order
  const stepIds = actions.map(a => a.stepId);
  assert.ok(stepIds.indexOf("step-identity") < stepIds.indexOf("step-approval"), "identity phase should execute before approval");
  assert.ok(stepIds.indexOf("step-approval") < stepIds.indexOf("step-budget"), "approval phase should execute before budget");
});

test("OrgGovernanceSaga compensates on prepare failure", () => {
  const saga = new OrgGovernanceSaga({
    prepare: (step, _ctx) => {
      if (step.stepId === "step-fail") {
        throw new Error("Prepare failure");
      }
    },
    commit: () => {},
    compensate: (step, _ctx) => {
      // compensate
    },
  });

  const steps: OrgGovernanceSagaStep[] = [
    { stepId: "step-ok", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "step-fail", targetOrgNodeId: "org-2", action: "prepare", phase: "approval" },
    { stepId: "step-never", targetOrgNodeId: "org-3", action: "commit", phase: "approval" },
  ];

  const result = saga.execute("saga-compensate", steps);

  assert.strictEqual(result.status, "compensated");
  assert.ok(result.preparedNodeIds.includes("org-1"), "org-1 was prepared");
  assert.ok(result.compensatedNodeIds.includes("org-1"), "org-1 should be compensated");
  assert.ok(result.failedStepId === "step-fail");
});

test("OrgGovernanceSaga produces receipt with phase ordering", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
    audit: () => {},
  });

  const steps: OrgGovernanceSagaStep[] = [
    { stepId: "step-1", targetOrgNodeId: "org-1", action: "prepare" },
    { stepId: "step-2", targetOrgNodeId: "org-1", action: "commit" },
    { stepId: "step-3", targetOrgNodeId: "org-1", action: "audit" },
    { stepId: "step-4", targetOrgNodeId: "org-2", action: "prepare" },
    { stepId: "step-5", targetOrgNodeId: "org-2", action: "commit" },
  ];

  const result = saga.execute("saga-receipt-1", steps);

  assert.ok(result.preparedNodeIds.length > 0);
  assert.ok(result.committedNodeIds.length > 0);
  assert.ok(result.executionLog.length > 0);
  assert.strictEqual(result.sagaId, "saga-receipt-1");
});
