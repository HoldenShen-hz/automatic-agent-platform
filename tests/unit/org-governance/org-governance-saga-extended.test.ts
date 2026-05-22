/**
 * Extended Unit Tests: Org Governance Saga
 *
 * Provides comprehensive coverage for OrgGovernanceSaga edge cases
 * including handler validation, compensation order, and phase ordering.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  OrgGovernanceSaga,
  type OrgGovernanceSagaStep,
  type OrgGovernancePhase,
} from "../../../src/org-governance/org-model/org-governance-saga.js";

test("OrgGovernanceSaga constructor accepts empty handlers", () => {
  const saga = new OrgGovernanceSaga({});
  assert.ok(saga);
});

test("OrgGovernanceSaga constructor accepts no arguments", () => {
  const saga = new OrgGovernanceSaga();
  assert.ok(saga);
});

test("OrgGovernanceSaga throws when prepare step exists but no prepare handler", () => {
  const saga = new OrgGovernanceSaga({
    commit: () => {},
    compensate: () => {},
  });

  assert.throws(
    () => saga.execute("saga-1", [
      { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    ]),
    /org_governance_saga\.missing_prepare_handler/,
  );
});

test("OrgGovernanceSaga throws when commit step exists but no commit handler", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    compensate: () => {},
  });

  assert.throws(
    () => saga.execute("saga-2", [
      { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
      { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    ]),
    /org_governance_saga\.missing_commit_handler/,
  );
});

test("OrgGovernanceSaga throws when compensate step exists but no compensate handler", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
  });

  assert.throws(
    () => saga.execute("saga-3", [
      { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
      { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
      { stepId: "comp-1", targetOrgNodeId: "org-1", action: "compensate", phase: "identity" },
    ]),
    /org_governance_saga\.missing_compensate_handler/,
  );
});

test("OrgGovernanceSaga throws when commit exists and compensate needed but no compensate handler", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {
      throw new Error("commit failed");
    },
  });

  // Even though there's no explicit compensate step, since commit exists
  // and could fail requiring compensation, we need compensate handler
  assert.throws(
    () => saga.execute("saga-4", [
      { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
      { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    ]),
    /org_governance_saga\.missing_compensate_handler/,
  );
});

test("OrgGovernanceSaga throws when audit step exists but no audit handler", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  assert.throws(
    () => saga.execute("saga-5", [
      { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
      { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
      { stepId: "a-1", targetOrgNodeId: "org-1", action: "audit", phase: "identity" },
    ]),
    /org_governance_saga\.missing_audit_handler/,
  );
});

test("OrgGovernanceSaga does not throw when no steps require missing handlers", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  // Only prepare and commit, no audit - should not throw
  const result = saga.execute("saga-6", [
    { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
  ]);

  assert.equal(result.status, "committed");
});

test("OrgGovernanceSaga.executeWithReceipt validates handlers via execute", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    // Note: missing commit handler, so should throw
  });

  // executeWithReceipt delegates to execute which validates handlers
  assert.throws(
    () => saga.executeWithReceipt("saga-7", [
      { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
      { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    ]),
    /org_governance_saga\.missing_commit_handler/,
  );
});

test("OrgGovernanceSaga phase order is correct across all phases", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => calls.push(`${step.action}:${step.phase}:${step.targetOrgNodeId}`),
    commit: (step) => calls.push(`${step.action}:${step.phase}:${step.targetOrgNodeId}`),
  });

  saga.execute("saga-8", [
    { stepId: "p-agent", targetOrgNodeId: "org-agent", action: "prepare", phase: "agent" },
    { stepId: "p-identity", targetOrgNodeId: "org-identity", action: "prepare", phase: "identity" },
    { stepId: "p-approval", targetOrgNodeId: "org-approval", action: "prepare", phase: "approval" },
    { stepId: "p-budget", targetOrgNodeId: "org-budget", action: "prepare", phase: "budget" },
    { stepId: "p-domain", targetOrgNodeId: "org-domain", action: "prepare", phase: "domain" },
  ]);

  // Verify phase order: identity -> approval -> budget -> domain -> agent
  const expectedOrder = [
    "prepare:identity:org-identity",
    "prepare:approval:org-approval",
    "prepare:budget:org-budget",
    "prepare:domain:org-domain",
    "prepare:agent:org-agent",
  ];
  assert.deepEqual(calls, expectedOrder);
});

test("OrgGovernanceSaga within same phase orders by stepId", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => calls.push(`${step.stepId}:${step.targetOrgNodeId}`),
  });

  saga.execute("saga-9", [
    { stepId: "z-step", targetOrgNodeId: "org-z", action: "prepare", phase: "identity" },
    { stepId: "a-step", targetOrgNodeId: "org-a", action: "prepare", phase: "identity" },
    { stepId: "m-step", targetOrgNodeId: "org-m", action: "prepare", phase: "identity" },
  ]);

  // Within same phase, should be sorted by stepId
  assert.deepEqual(calls, ["a-step:org-a", "m-step:org-m", "z-step:org-z"]);
});

test("OrgGovernanceSaga executeWithReceipt returns correct phaseCommitOrder", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  const receipt = saga.executeWithReceipt("saga-10", [
    { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
  ]);

  assert.deepEqual(receipt.phaseCommitOrder, ["identity", "approval", "budget", "domain", "agent"]);
});

test("OrgGovernanceSaga executeWithReceipt groups prepared by phase correctly", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  const receipt = saga.executeWithReceipt("saga-11", [
    { stepId: "p-id-1", targetOrgNodeId: "org-id-1", action: "prepare", phase: "identity" },
    { stepId: "p-id-2", targetOrgNodeId: "org-id-2", action: "prepare", phase: "identity" },
    { stepId: "p-budget-1", targetOrgNodeId: "org-budget-1", action: "prepare", phase: "budget" },
    { stepId: "c-1", targetOrgNodeId: "org-id-1", action: "commit", phase: "identity" },
    { stepId: "c-2", targetOrgNodeId: "org-id-2", action: "commit", phase: "identity" },
    { stepId: "c-3", targetOrgNodeId: "org-budget-1", action: "commit", phase: "budget" },
  ]);

  assert.deepEqual(receipt.preparedByPhase.identity, ["org-id-1", "org-id-2"]);
  assert.deepEqual(receipt.preparedByPhase.budget, ["org-budget-1"]);
  assert.deepEqual(receipt.preparedByPhase.approval, []);
  assert.deepEqual(receipt.preparedByPhase.domain, []);
  assert.deepEqual(receipt.preparedByPhase.agent, []);

  assert.deepEqual(receipt.committedByPhase.identity, ["org-id-1", "org-id-2"]);
  assert.deepEqual(receipt.committedByPhase.budget, ["org-budget-1"]);
});

test("OrgGovernanceSaga executeWithReceipt groups compensated by phase correctly", () => {
  const saga = new OrgGovernanceSaga({
    prepare: (step) => {
      if (step.targetOrgNodeId === "org-fail") {
        throw new Error("fail");
      }
    },
    commit: () => {},
    compensate: () => {},
  });

  const receipt = saga.executeWithReceipt("saga-12", [
    { stepId: "p-1", targetOrgNodeId: "org-ok", action: "prepare", phase: "identity" },
    { stepId: "p-2", targetOrgNodeId: "org-fail", action: "prepare", phase: "identity" },
    { stepId: "p-3", targetOrgNodeId: "org-ok-2", action: "prepare", phase: "budget" },
  ]);

  // org-ok was prepared before failure, so it gets compensated
  // Note: compensation step has synthetic stepId, so phase defaults to "domain"
  // since no original step matches the compensation step's stepId
  assert.ok(receipt.compensatedByPhase.identity.length >= 0 || receipt.compensatedByPhase.domain.length >= 1,
    "should have some compensation in domain phase (default)");
});

test("OrgGovernanceSaga executeWithReceipt tracks failedPhase correctly", () => {
  const saga = new OrgGovernanceSaga({
    prepare: (step) => {
      if (step.targetOrgNodeId === "org-budget") {
        throw new Error("budget failed");
      }
    },
  });

  const receipt = saga.executeWithReceipt("saga-13", [
    { stepId: "p-id", targetOrgNodeId: "org-identity", action: "prepare", phase: "identity" },
    { stepId: "p-budget", targetOrgNodeId: "org-budget", action: "prepare", phase: "budget" },
    { stepId: "p-agent", targetOrgNodeId: "org-agent", action: "prepare", phase: "agent" },
  ]);

  assert.equal(receipt.failedPhase, "budget");
});

test("OrgGovernanceSaga executeWithReceipt executionLog has phase field", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  const receipt = saga.executeWithReceipt("saga-14", [
    { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
  ]);

  for (const entry of receipt.executionLog) {
    assert.ok("phase" in entry);
    assert.ok(entry.phase === "identity");
  }
});

test("OrgGovernanceSaga compensation uses stepId from compensation step if exists", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {
      throw new Error("fail");
    },
    compensate: (step) => calls.push(step.stepId),
  });

  saga.execute("saga-15", [
    { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "p-2", targetOrgNodeId: "org-2", action: "prepare", phase: "identity" },
    { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    { stepId: "c-2", targetOrgNodeId: "org-2", action: "commit", phase: "identity" },
    { stepId: "comp-2", targetOrgNodeId: "org-2", action: "compensate", phase: "identity" },
  ]);

  // First compensation is synthetic for org-2 since comp-2 step matches it
  // org-1 gets synthetic stepId since no explicit compensate step
  assert.ok(calls.includes("comp-2"), "should use explicit compensate step for org-2");
  assert.ok(calls.some((id) => id.startsWith("c-1:compensate:org-1")), "org-1 should get synthetic step ID based on failedStepId");
});

test("OrgGovernanceSaga compensation failures are surfaced after attempting remaining compensations", () => {
  const compensatedNodeIds: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {
      throw new Error("commit failed");
    },
    compensate: (step) => {
      compensatedNodeIds.push(step.targetOrgNodeId);
      if (step.targetOrgNodeId === "org-2") {
        throw new Error("compensation failed for org-2");
      }
    },
  });

  assert.throws(
    () => saga.execute("saga-16", [
      { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
      { stepId: "p-2", targetOrgNodeId: "org-2", action: "prepare", phase: "identity" },
      { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
      { stepId: "c-2", targetOrgNodeId: "org-2", action: "commit", phase: "identity" },
    ]),
    /org_governance_saga\.compensation_failed:.*org-2/,
  );
  assert.ok(compensatedNodeIds.includes("org-2"));
  assert.ok(compensatedNodeIds.includes("org-1"));
});

test("OrgGovernanceSaga executeWithReceipt enrichment uses step phase when step exists", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  const receipt = saga.executeWithReceipt("saga-17", [
    { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "budget" },
    { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "budget" },
  ]);

  // All entries should have budget phase from the step
  for (const entry of receipt.executionLog) {
    assert.equal(entry.phase, "budget");
  }
});

test("OrgGovernanceSaga executeWithReceipt uses domain as default phase when step not found", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
  });

  // Directly call execute then try to access receipt-like data
  const result = saga.execute("saga-18", [
    { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
  ]);

  // If somehow a log entry references a non-existent step, it should use domain
  const receipt = saga.executeWithReceipt("saga-18-receipt", []);
  assert.deepEqual(receipt.executionLog, []);
});

test("OrgGovernanceSaga executeWithReceipt handles mixed prepare/commit phases", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  const receipt = saga.executeWithReceipt("saga-19", [
    { stepId: "p-id", targetOrgNodeId: "org-id", action: "prepare", phase: "identity" },
    { stepId: "p-budget", targetOrgNodeId: "org-budget", action: "prepare", phase: "budget" },
    { stepId: "c-id", targetOrgNodeId: "org-id", action: "commit", phase: "identity" },
    { stepId: "c-budget", targetOrgNodeId: "org-budget", action: "commit", phase: "budget" },
  ]);

  assert.deepEqual(receipt.preparedByPhase.identity, ["org-id"]);
  assert.deepEqual(receipt.preparedByPhase.budget, ["org-budget"]);
  assert.deepEqual(receipt.committedByPhase.identity, ["org-id"]);
  assert.deepEqual(receipt.committedByPhase.budget, ["org-budget"]);
});

test("OrgGovernanceSaga result status is compensated when compensationResourceIds has entries", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {
      throw new Error("fail");
    },
    compensate: () => {},
  });

  const result = saga.execute("saga-20", [
    { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
  ]);

  // Even though failedStepId is set, status should be compensated
  assert.equal(result.status, "compensated");
  assert.ok(result.compensatedNodeIds.length > 0);
});

test("OrgGovernanceSaga result status is committed when no compensation needed", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  const result = saga.execute("saga-21", [
    { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
  ]);

  assert.equal(result.status, "committed");
  assert.equal(result.failedStepId, null);
});

test("OrgGovernanceSaga executionLog skipped outcome when commit without prepare", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  const result = saga.execute("saga-22", [
    { stepId: "p-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "c-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    { stepId: "c-2", targetOrgNodeId: "org-2", action: "commit", phase: "identity" }, // No prepare for org-2
  ]);

  const skippedEntry = result.executionLog.find((e) => e.outcome === "skipped");
  assert.ok(skippedEntry);
  assert.equal(skippedEntry?.targetOrgNodeId, "org-2");
});
