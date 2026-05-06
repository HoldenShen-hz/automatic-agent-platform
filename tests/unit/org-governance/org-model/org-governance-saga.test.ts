import assert from "node:assert/strict";
import test from "node:test";

import { OrgGovernanceSaga } from "../../../../src/org-governance/org-model/org-governance-saga.js";
import type { OrgGovernanceSagaStep, OrgGovernancePhase } from "../../../../src/org-governance/org-model/org-governance-saga.js";

test("OrgGovernanceSaga executes prepare commit audit in correct order when no failure occurs", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => calls.push(`prepare:${step.targetOrgNodeId}`),
    commit: (step) => calls.push(`commit:${step.targetOrgNodeId}`),
    compensate: (step) => calls.push(`compensate:${step.targetOrgNodeId}`),
    audit: (step) => calls.push(`audit:${step.targetOrgNodeId}`),
  });

  const result = saga.execute("saga-1", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    { stepId: "compensate-1", targetOrgNodeId: "org-1", action: "compensate", phase: "identity" },
    { stepId: "audit-1", targetOrgNodeId: "org-1", action: "audit", phase: "identity" },
  ]);

  assert.equal(result.status, "committed");
  assert.equal(result.sagaId, "saga-1");
  assert.deepEqual(result.preparedNodeIds, ["org-1"]);
  assert.deepEqual(result.committedNodeIds, ["org-1"]);
  assert.deepEqual(result.compensatedNodeIds, []);
  assert.deepEqual(result.auditStepIds, ["audit-1"]);
  assert.equal(result.failedStepId, null);
});

test("OrgGovernanceSaga compensates committed and prepared nodes when commit fails", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => calls.push(`prepare:${step.targetOrgNodeId}`),
    commit: (step) => {
      calls.push(`commit:${step.targetOrgNodeId}`);
      if (step.targetOrgNodeId === "org-2") {
        throw new Error("commit failed");
      }
    },
    compensate: (step) => calls.push(`compensate:${step.targetOrgNodeId}`),
  });

  const result = saga.execute("saga-2", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "prepare-2", targetOrgNodeId: "org-2", action: "prepare", phase: "identity" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    { stepId: "commit-2", targetOrgNodeId: "org-2", action: "commit", phase: "identity" },
  ]);

  assert.equal(result.failedStepId, "commit-2");
  assert.equal(result.status, "compensated");
  assert.deepEqual(result.compensatedNodeIds, ["org-2", "org-1"]);
  assert.deepEqual(calls, [
    "prepare:org-1",
    "prepare:org-2",
    "commit:org-1",
    "commit:org-2",
    "compensate:org-2",
    "compensate:org-1",
  ]);
});

test("OrgGovernanceSaga sorts steps by phase order", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => calls.push(`prepare:${step.phase}:${step.targetOrgNodeId}`),
  });

  saga.execute("saga-3", [
    { stepId: "p-agent", targetOrgNodeId: "org-agent", action: "prepare", phase: "agent" },
    { stepId: "p-identity", targetOrgNodeId: "org-identity", action: "prepare", phase: "identity" },
    { stepId: "p-budget", targetOrgNodeId: "org-budget", action: "prepare", phase: "budget" },
  ]);

  assert.deepEqual(calls, [
    "prepare:identity:org-identity",
    "prepare:budget:org-budget",
    "prepare:agent:org-agent",
  ]);
});

test("OrgGovernanceSaga skips commit for unprepared nodes", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => {
      if (step.targetOrgNodeId === "org-1") {
        calls.push("prepare:org-1");
      }
    },
    commit: (step) => calls.push(`commit:${step.targetOrgNodeId}`),
    compensate: (step) => calls.push(`compensate:${step.targetOrgNodeId}`),
  });

  const result = saga.execute("saga-4", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    { stepId: "commit-2", targetOrgNodeId: "org-2", action: "commit", phase: "identity" },
  ]);

  assert.equal(result.failedStepId, "commit-2");
  assert.ok(result.executionLog.some(
    (e) => e.stepId === "commit-2" && e.outcome === "skipped"
  ));
});

test("OrgGovernanceSaga executes compensation handlers on prepare failure", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => {
      calls.push(`prepare:${step.targetOrgNodeId}`);
      if (step.targetOrgNodeId === "org-2") {
        throw new Error("prepare failed");
      }
    },
    compensate: (step) => calls.push(`compensate:${step.targetOrgNodeId}`),
  });

  const result = saga.execute("saga-5", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "prepare-2", targetOrgNodeId: "org-2", action: "prepare", phase: "identity" },
    { stepId: "prepare-3", targetOrgNodeId: "org-3", action: "prepare", phase: "identity" },
  ]);

  assert.equal(result.failedStepId, "prepare-2");
  assert.equal(result.status, "compensated");
  assert.deepEqual(result.compensatedNodeIds, ["org-1"]);
  assert.deepEqual(calls, [
    "prepare:org-1",
    "prepare:org-2",
    "compensate:org-1",
  ]);
});

test("OrgGovernanceSaga ignores explicit compensate steps when no failure occurs", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => calls.push(`prepare:${step.targetOrgNodeId}`),
    commit: (step) => calls.push(`commit:${step.targetOrgNodeId}`),
    compensate: (step) => calls.push(`compensate:${step.targetOrgNodeId}`),
  });

  const result = saga.execute("saga-6", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    { stepId: "compensate-1", targetOrgNodeId: "org-1", action: "compensate", phase: "identity" },
  ]);

  assert.equal(result.status, "committed");
  assert.deepEqual(calls, ["prepare:org-1", "commit:org-1"]);
});

test("OrgGovernanceSaga status is committed when no compensation needed", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  const result = saga.execute("saga-7", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
  ]);

  assert.equal(result.status, "committed");
  assert.equal(result.failedStepId, null);
});

test("OrgGovernanceSaga executeWithReceipt returns phase breakdown", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
    audit: () => {},
  });

  const receipt = saga.executeWithReceipt("saga-8", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    { stepId: "audit-1", targetOrgNodeId: "org-1", action: "audit", phase: "identity" },
  ]);

  assert.equal(receipt.sagaId, "saga-8");
  assert.equal(receipt.status, "committed");
  assert.deepEqual(receipt.phaseCommitOrder, ["identity", "approval", "budget", "domain", "agent"]);
  assert.deepEqual(receipt.preparedByPhase.identity, ["org-1"]);
  assert.deepEqual(receipt.committedByPhase.identity, ["org-1"]);
  assert.equal(receipt.failedPhase, null);
});

test("OrgGovernanceSaga executeWithReceipt tracks failed phase", () => {
  const saga = new OrgGovernanceSaga({
    prepare: (step) => {
      if (step.targetOrgNodeId === "org-budget") {
        throw new Error("budget failed");
      }
    },
    compensate: () => {},
  });

  const receipt = saga.executeWithReceipt("saga-9", [
    { stepId: "p-identity", targetOrgNodeId: "org-identity", action: "prepare", phase: "identity" },
    { stepId: "p-budget", targetOrgNodeId: "org-budget", action: "prepare", phase: "budget" },
    { stepId: "c-identity", targetOrgNodeId: "org-identity", action: "compensate", phase: "identity" },
    { stepId: "p-agent", targetOrgNodeId: "org-agent", action: "prepare", phase: "agent" },
  ]);

  assert.equal(receipt.failedPhase, "budget");
  assert.deepEqual(receipt.compensatedByPhase.identity, ["org-identity"]);
});

test("OrgGovernanceSaga execution log contains all outcomes", () => {
  const saga = new OrgGovernanceSaga({
    prepare: (step) => {
      if (step.targetOrgNodeId === "org-2") {
        throw new Error("fail");
      }
    },
    commit: () => {},
    compensate: () => {},
  });

  const result = saga.execute("saga-10", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "prepare-2", targetOrgNodeId: "org-2", action: "prepare", phase: "identity" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
  ]);

  const prepared = result.executionLog.filter((e) => e.outcome === "prepared");
  const failed = result.executionLog.filter((e) => e.outcome === "failed");
  const compensated = result.executionLog.filter((e) => e.outcome === "compensated");

  assert.ok(prepared.length >= 1);
  assert.ok(failed.length >= 1);
  assert.ok(compensated.length >= 1);
});

test("OrgGovernanceSaga context contains sagaId and failedStepId", () => {
  const contexts: Array<{ sagaId: string; failedStepId: string | null }> = [];
  const saga = new OrgGovernanceSaga({
    prepare: (_step, ctx) => contexts.push({ ...ctx }),
    commit: (_step, ctx) => contexts.push({ ...ctx }),
    compensate: (_step, ctx) => contexts.push({ ...ctx }),
  });

  saga.execute("saga-context-1", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
  ]);

  for (const ctx of contexts) {
    assert.equal(ctx.sagaId, "saga-context-1");
  }
});

test("OrgGovernanceSaga context updates failedStepId on failure", () => {
  let lastContext: { sagaId: string; failedStepId: string | null } | null = null;
  const saga = new OrgGovernanceSaga({
    prepare: (step) => {
      if (step.targetOrgNodeId === "org-2") {
        throw new Error("fail");
      }
    },
    compensate: (_step, ctx) => {
      lastContext = ctx;
    },
  });

  saga.execute("saga-context-2", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "prepare-2", targetOrgNodeId: "org-2", action: "prepare", phase: "identity" },
  ]);

  assert.equal(lastContext?.failedStepId, "prepare-2");
});

test("OrgGovernanceSaga handles empty steps array", () => {
  const saga = new OrgGovernanceSaga({});

  const result = saga.execute("saga-empty", []);

  assert.equal(result.status, "committed");
  assert.deepEqual(result.preparedNodeIds, []);
  assert.deepEqual(result.committedNodeIds, []);
  assert.deepEqual(result.compensatedNodeIds, []);
  assert.equal(result.failedStepId, null);
});

test("OrgGovernanceSaga result contains all expected fields", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
  });
  const result = saga.execute("saga-fields", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
  ]);

  assert.ok("sagaId" in result);
  assert.ok("status" in result);
  assert.ok("preparedNodeIds" in result);
  assert.ok("committedNodeIds" in result);
  assert.ok("compensatedNodeIds" in result);
  assert.ok("auditStepIds" in result);
  assert.ok("failedStepId" in result);
  assert.ok("executionLog" in result);
});

test("OrgGovernanceSaga receipt contains all expected fields", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
  });
  const receipt = saga.executeWithReceipt("saga-receipt-fields", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
  ]);

  assert.ok("sagaId" in receipt);
  assert.ok("status" in receipt);
  assert.ok("phaseCommitOrder" in receipt);
  assert.ok("preparedByPhase" in receipt);
  assert.ok("committedByPhase" in receipt);
  assert.ok("compensatedByPhase" in receipt);
  assert.ok("failedPhase" in receipt);
  assert.ok("executionLog" in receipt);
});

test("OrgGovernanceSaga compensation reverses committed then prepared nodes", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => calls.push(`prepare:${step.targetOrgNodeId}`),
    commit: (step) => {
      calls.push(`commit:${step.targetOrgNodeId}`);
      if (step.targetOrgNodeId === "org-3") {
        throw new Error("commit failed");
      }
    },
    compensate: (step) => calls.push(`compensate:${step.targetOrgNodeId}`),
  });

  saga.execute("saga-11", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "prepare-2", targetOrgNodeId: "org-2", action: "prepare", phase: "identity" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
    { stepId: "commit-2", targetOrgNodeId: "org-2", action: "commit", phase: "identity" },
    { stepId: "prepare-3", targetOrgNodeId: "org-3", action: "prepare", phase: "identity" },
    { stepId: "commit-3", targetOrgNodeId: "org-3", action: "commit", phase: "identity" },
  ]);

  const compensateCalls = calls.filter((c) => c.startsWith("compensate:"));
  assert.deepEqual(compensateCalls, ["compensate:org-3", "compensate:org-2", "compensate:org-1"]);
});

test("OrgGovernanceSaga missing optional audit handler is handled gracefully", () => {
  const saga = new OrgGovernanceSaga({
    prepare: () => {},
    commit: () => {},
    compensate: () => {},
  });

  const result = saga.execute("saga-no-handlers", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "identity" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "identity" },
  ]);

  assert.equal(result.status, "committed");
  assert.deepEqual(result.preparedNodeIds, ["org-1"]);
  assert.deepEqual(result.committedNodeIds, ["org-1"]);
});
