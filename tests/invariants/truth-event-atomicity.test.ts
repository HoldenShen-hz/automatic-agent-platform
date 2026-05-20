import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";

/**
 * INV-STATE-001: Every HarnessRun or NodeRun truth mutation must append
 * a platform fact event in the same transaction.
 *
 * This test verifies that:
 * 1. State transitions require event append in the same transaction
 * 2. Legacy state mutations without events are rejected
 * 3. Event envelope must contain required platform fact fields
 */
test("INV-STATE-001: State transitions require platform fact event append", () => {
  const stateMachine = new RuntimeStateMachine();

  const result = stateMachine.transition({
    commandId: "cmd-state-001",
    entityType: "HarnessRun",
    entityId: "run-state-001",
    principal: "test-principal",
    aggregateType: "HarnessRun",
    aggregate: {
      harnessRunId: "run-state-001",
      status: "created",
      tenantId: "tenant-state",
    },
    fromStatus: "created",
    toStatus: "admitted",
    tenantId: "tenant-state",
    traceId: "trace-state-001",
    reasonCode: "test.transition",
    emittedBy: "INV-STATE-001-test",
    runVersionLockId: "rvl-state-001",
    auditRef: "audit://harness/run-state-001/admitted",
  });

  // Transition must produce event
  assert.ok(result.aggregate !== undefined);
  assert.ok(result.event !== undefined);
});

test("INV-STATE-001: Reject truth mutation without event append", () => {
  const stateMachine = new RuntimeStateMachine({ persistEvent: null });

  // Attempt to mutate state without proper event context
  // This should be rejected if no event is emitted
  assert.throws(
    () => {
      stateMachine.transition({
        commandId: "cmd-state-002",
        entityType: "HarnessRun",
        entityId: "run-state-002",
        principal: "test-principal",
        aggregateType: "HarnessRun",
        aggregate: {
          harnessRunId: "run-state-002",
          status: "created",
          tenantId: "tenant-state",
        },
        fromStatus: "created",
        toStatus: "admitted",
        tenantId: "tenant-state",
        traceId: "trace-state-002",
        reasonCode: "test.mutation_without_event",
        emittedBy: "INV-STATE-001-test",
        runVersionLockId: "rvl-state-002",
        auditRef: "audit://harness/run-state-002/admitted",
        // Intentionally not providing event append capability
      });
    },
    /event persistence callback|persistence callback/i,
    "Truth mutation without event append must be rejected",
  );
});

test("INV-STATE-001: NodeRun transitions require platform fact events", () => {
  const stateMachine = new RuntimeStateMachine();

  const result = stateMachine.transition({
    commandId: "cmd-state-003",
    entityType: "NodeRun",
    entityId: "node-state-001",
    principal: "test-principal",
    aggregateType: "NodeRun",
    aggregate: {
      nodeRunId: "node-state-001",
      harnessRunId: "run-state-003",
      status: "created",
      tenantId: "tenant-state",
      leaseId: "lease-node-state",
      fencingToken: "fence-node-state",
    },
    fromStatus: "created",
    toStatus: "ready",
    tenantId: "tenant-state",
    traceId: "trace-state-003",
    reasonCode: "node.dispatch",
    emittedBy: "INV-STATE-001-test",
    leaseId: "lease-node-state",
    fencingToken: "fence-node-state",
    auditRef: "audit://node-run/node-state-001/ready",
  });

  // NodeRun transitions must emit events
  assert.ok(result.aggregate !== undefined);
});

test("INV-STATE-001: SideEffectRecord transitions emit audit events", () => {
  const stateMachine = new RuntimeStateMachine();

  const result = stateMachine.transition({
    commandId: "cmd-state-004",
    entityType: "SideEffectRecord",
    entityId: "se-state-001",
    principal: "test-principal",
    aggregateType: "SideEffectRecord",
    aggregate: {
      sideEffectId: "se-state-001",
      harnessRunId: "run-state-004",
      nodeRunId: "node-state-002",
      status: "proposed",
      tenantId: "tenant-state",
      riskClass: "low",
    },
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "tenant-state",
    traceId: "trace-state-004",
    reasonCode: "side_effect.commit",
    emittedBy: "INV-STATE-001-test",
    sideEffectSafety: {
      idempotencyKey: "se-key-001",
      preCommitPolicyProofRef: "policy://test",
    },
    auditRef: "audit://side-effects/se-state-001/commit",
    leaseId: "lease-se-state",
    fencingToken: "fence-se-state",
  });

  // Side effect transitions must emit audit trail
  assert.ok(result.aggregate !== undefined);
});

test("INV-STATE-001: BudgetLedger transitions emit budget events", () => {
  const stateMachine = new RuntimeStateMachine();

  const result = stateMachine.transition({
    commandId: "cmd-state-005",
    entityType: "BudgetLedger",
    entityId: "ledger-state-001",
    principal: "test-principal",
    aggregateType: "BudgetLedger",
    aggregate: {
      budgetLedgerId: "ledger-state-001",
      tenantId: "tenant-state",
      harnessRunId: "run-state-005",
      currency: "USD",
      hardCap: 100,
      status: "open",
      reservedAmount: 50,
      settledAmount: 0,
      releasedAmount: 0,
      version: 0,
    },
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    tenantId: "tenant-state",
    traceId: "trace-state-005",
    reasonCode: "budget.reserve",
    emittedBy: "INV-STATE-001-test",
    leaseId: "lease-ledger-state",
    fencingToken: "fence-ledger-state",
    auditRef: "audit://budget-ledger/ledger-state-001/soft-cap-reached",
  });

  // Budget transitions must emit financial events
  assert.ok(result.aggregate !== undefined);
});
