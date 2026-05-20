import assert from "node:assert/strict";
import test from "node:test";

import { createHarnessRun } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";

test("RuntimeStateMachine requires auditRef on audited HarnessRun transitions", () => {
  const machine = new RuntimeStateMachine({ persistEvent: () => {} });
  const run = createHarnessRun({
    harnessRunId: "run-audit-required",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    currentSeq: 0,
  });

  assert.throws(() => {
    machine.transition({
      commandId: "cmd-audit-required",
      entityType: "HarnessRun",
      entityId: run.harnessRunId,
      principal: "operator-1",
      aggregateType: "HarnessRun",
      aggregate: run,
      fromStatus: "created",
      toStatus: "admitted",
      tenantId: "tenant-1",
      traceId: "trace-audit-required",
      reasonCode: "admission_ok",
      emittedBy: "admission-controller",
      leaseId: "lease-1",
      fencingToken: "fence-1",
      runVersionLockId: "rvlock-1",
    });
  }, /audit ref is required/i);
});
