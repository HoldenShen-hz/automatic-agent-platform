# ADR-110: Runtime State Machine Authority

## Status

Accepted

## Decision Date

2026-04-27

## Context

v4.3 uses `HarnessRun`, `NodeRun`, `SideEffectRecord`, and `BudgetLedger` as P5 truth core objects. If P2, P3, P4, Recovery, HITL, or operator tools can directly write truth tables, terminal state closure, CAS, lease, fencing, budget hard cap, side effect reconciliation, and audit events same-transaction append cannot be guaranteed.

## Decision

1. `RuntimeStateMachine.transition(command)` is the sole formal entry for status progression of the following objects:
   - `HarnessRun`
   - `NodeRun`
   - `NodeAttempt`
   - `SideEffectRecord`
   - `ReconciliationRecord`
   - `CompensationRecord`
   - `BudgetReservation`
   - `BudgetSettlement`
2. All transitions must complete in the same transaction:
   - Validate current state, target state, and terminal state closure rules.
   - Validate CAS version, active lease, fencing token, and `RunVersionLock`.
   - Validate policy guard, budget precondition, and side-effect safety.
   - Write truth mutation.
   - Append `platform.*` fact event.
   - Write audit / evidence references.
3. P2/P3/P4/Recovery/HITL can only submit `TransitionCommand` and must not directly update truth tables.
4. Old `StateCommand` / `StateMutationCommand` can only serve as internal compatibility wrapper; must not serve as public API or new module export.

## State Machine Principles

- Terminal state cannot transition out; repair can only be expressed through redrive, compensation, GraphPatch, child run, or new HarnessRun append.
- `retry_wait`, `awaiting_hitl`, `reconciling` are non-terminal waiting states and must carry wake condition or external resolution record.
- Budget reservation and settlement must obey hard cap; concurrent overbooking is not allowed.
- Side effect commit must re-validate policy, budget, lease, fencing, and human approval before committing.

## Consequences

- Runtime tests must establish around transition matrix, terminal closure, concurrent CAS, budget hard cap, and side-effect commit gate.
- Storage repository can provide read/write primitives but cannot expose truth mutation methods bypassing state machine to business layer.
- Operator recovery and panic path must also submit transition unless entering read-only forensic mode.

## Related Documents

- [109-contract-freeze.md](./109-contract-freeze.md)
- [runtime_state_machine_contract.md](../contracts/runtime_state_machine_contract.md)
- [harness-run-contract.md](../contracts/harness-run-contract.md)
- [node-run-attempt-receipt-contract.md](../contracts/node-run-attempt-receipt-contract.md)