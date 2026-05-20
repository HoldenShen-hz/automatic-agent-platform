import assert from "node:assert/strict";
import test from "node:test";

import {
  ComplianceExceptionWorkflowEngine,
  type ComplianceExceptionRequest,
} from "../../../../src/org-governance/compliance-engine/compliance-exception-workflow.js";

function createExceptionRequest(): ComplianceExceptionRequest {
  return {
    exceptionId: "exception_1",
    frameworkId: "soc2",
    controlId: "cc_1",
    requesterId: "user_1",
    justification: "temporary migration",
    riskImpact: "low",
    proposedMitigation: "manual review",
    compensatingControls: ["control_a"],
    requestedApprovalDuration: "P30D",
    submittedAt: "2026-05-20T00:00:00.000Z",
    status: "pending_review",
  };
}

test("ComplianceExceptionWorkflowEngine dedupes remediation task links", () => {
  const engine = new ComplianceExceptionWorkflowEngine();
  const workflow = engine.initiateWorkflow(createExceptionRequest(), ["approver_1"]);

  assert.equal(engine.linkRemediationTask(workflow.workflowId, "task_1"), true);
  assert.equal(engine.linkRemediationTask(workflow.workflowId, "task_1"), true);

  const updated = engine.getWorkflow(workflow.workflowId);
  assert.deepEqual(updated?.remediationTaskIds, ["task_1"]);
});
