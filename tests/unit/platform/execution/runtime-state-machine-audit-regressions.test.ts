import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../src/platform/contracts/errors.js";
import { createHarnessRun } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../../../src/platform/execution/runtime-state-machine.js";

test("RuntimeStateMachine rejects null auditRef for requires-audit HarnessRun transitions", () => {
  const machine = new RuntimeStateMachine({
    persistEvent: () => {},
  });
  const run = createHarnessRun({
    harnessRunId: "run-audit-null",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    currentSeq: 0,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        expectedSeq: 0,
        traceId: "trace-audit-null",
        tenantId: "tenant-1",
        reasonCode: "admission_ok",
        emittedBy: "admission-controller",
        leaseId: "lease-1",
        fencingToken: "fence-1",
        runVersionLockId: "rvlock-1",
        policyGuard: { allowed: true, policyProofRef: "policy-proof-1" },
        auditRef: "",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError
      && error.code === "runtime_state_machine.audit_ref_invalid",
  );
});
