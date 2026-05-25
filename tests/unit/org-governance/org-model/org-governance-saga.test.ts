import assert from "node:assert/strict";
import test from "node:test";

import { OrgGovernanceSaga } from "../../../../src/org-governance/org-model/org-governance-saga.js";

test("OrgGovernanceSaga executes prepare commit compensate audit handlers in order", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => calls.push(`prepare:${step.targetOrgNodeId}`),
    commit: (step) => calls.push(`commit:${step.targetOrgNodeId}`),
    compensate: (step) => calls.push(`compensate:${step.targetOrgNodeId}`),
    audit: (step) => calls.push(`audit:${step.targetOrgNodeId}`),
  });

  const result = saga.execute("saga-1", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit" },
    { stepId: "compensate-1", targetOrgNodeId: "org-1", action: "compensate" },
    { stepId: "audit-1", targetOrgNodeId: "org-1", action: "audit" },
  ]);

  assert.equal(result.status, "compensated");
  assert.deepEqual(calls, ["prepare:org-1", "commit:org-1", "compensate:org-1", "audit:org-1"]);
});

test("OrgGovernanceSaga compensates committed and prepared nodes when commit fails", () => {
  const calls: string[] = [];
  const saga = new OrgGovernanceSaga({
    prepare: (step) => calls.push(`prepare:${step.targetOrgNodeId}`),
    commit: (step) => {
      calls.push(`commit:${step.targetOrgNodeId}`);
      if (step.targetOrgNodeId === "org-2") {
        throw new Error("commit.failed");
      }
    },
    compensate: (step) => calls.push(`compensate:${step.targetOrgNodeId}`),
  });

  const result = saga.execute("saga-2", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare" },
    { stepId: "prepare-2", targetOrgNodeId: "org-2", action: "prepare" },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit" },
    { stepId: "commit-2", targetOrgNodeId: "org-2", action: "commit" },
  ]);

  assert.equal(result.failedStepId, "commit-2");
  assert.deepEqual(result.compensatedNodeIds, ["org-2", "org-1"]);
  assert.deepEqual(calls, [
    "prepare:org-1",
    "prepare:org-2",
    "commit:org-1",
    "commit:org-2",
    "compensate:org-2",
    "compensate:org-1",
  ]);
  const failedEntry = result.executionLog.find((entry) => entry.stepId === "commit-2");
  assert.equal(failedEntry?.outcome, "failed");
  assert.equal(failedEntry?.errorMessage, "commit.failed");
});
