import assert from "node:assert/strict";
import test from "node:test";

import { createBudgetLedger, createNodeRun } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";

test("RuntimeStateMachine requires auditRef before applying audited transitions", () => {
  const machine = new RuntimeStateMachine({ persistEvent: () => {} });
  const ledger = createBudgetLedger({
    budgetLedgerId: "ledger-audit",
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    currency: "USD",
    hardCap: 100,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 0,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "soft_cap_reached",
        expectedVersion: 0,
        traceId: "trace-audit",
        tenantId: "tenant-1",
        reasonCode: "budget.soft_cap",
        emittedBy: "test",
        leaseId: "lease-1",
        fencingToken: "fence-1",
      }),
    /Audit ref is required for audited transitions\./,
  );
});

test("RuntimeStateMachine surfaces persistence_required once audit and fencing prerequisites are satisfied", () => {
  const machine = new RuntimeStateMachine({ persistEvent: null });
  const ledger = createBudgetLedger({
    budgetLedgerId: "ledger-persist",
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    currency: "USD",
    hardCap: 100,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 1,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "hard_cap_reached",
        expectedVersion: 1,
        traceId: "trace-persist",
        tenantId: "tenant-1",
        reasonCode: "budget.hard_cap",
        emittedBy: "test",
        leaseId: "lease-1",
        fencingToken: "fence-1",
        auditRef: "audit://runtime/persist",
      }),
    /requires an event persistence callback before transitions can be applied\./,
  );
});

test("RuntimeStateMachine persists an event and increments version on success", () => {
  const persisted: string[] = [];
  const machine = new RuntimeStateMachine({
    persistEvent: (event) => {
      persisted.push(event.eventType);
    },
  });
  const ledger = createBudgetLedger({
    budgetLedgerId: "ledger-success",
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    currency: "USD",
    hardCap: 100,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 2,
  });

  const result = machine.transition({
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    expectedVersion: 2,
    traceId: "trace-success",
    tenantId: "tenant-1",
    reasonCode: "budget.soft_cap",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    auditRef: "audit://runtime/success",
  });

  assert.equal(result.aggregate.version, 3);
  assert.deepEqual(persisted, ["platform.budget_ledger.status_changed"]);
});

test("RuntimeStateMachine keeps terminalReason on terminal NodeRun transitions when reasonCode is supplied", () => {
  const machine = new RuntimeStateMachine({ persistEvent: () => {} });
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 2,
    leaseId: "lease-1",
    fencingToken: "node-1-fence",
  });

  const result = machine.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "running",
    toStatus: "failed",
    expectedSeq: 2,
    traceId: "trace-terminal",
    tenantId: "tenant-1",
    reasonCode: "node.failed",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "node-1-fence",
    auditRef: "audit://runtime/node-failed",
  });

  assert.equal(result.aggregate.terminalReason, "node.failed");
});
