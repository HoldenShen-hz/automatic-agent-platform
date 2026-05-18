# ADR-109: v4.3 Contract Freeze

## Status

Accepted

## Decision Date

2026-04-27

## Context

`docs_zh/architecture/00-platform-architecture.md` has converged v4.1 deep review, v4.2 pre-freeze corrections, and OAPEFLIR v4.4 executable spec into v4.3 executable specification freeze scope. Previous ADRs and contracts still contained multiple sets of historical naming including `ExecutionPlan`, `ExecutionReceipt`, `ControlDirective`, `StateCommand`, `workflow_run`, and linear `step` semantics. If these names continue to serve as implementation entry points, the runtime will form a second source of truth.

## Decision

1. v4.3 uses `00-platform-architecture.md` `§1.5 v4.3 Contract Freeze Scope` as the freeze scope.
2. First batch of implementations only uses the following 12 groups of contracts as canonical entry points:
   - `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope`
   - `HarnessRun`
   - `PlanGraphBundle` / `PlanGraph` / `PlanNode` / `PlanEdge`
   - `GraphPatch` / `GraphPatchOperation`
   - `NodeRun` / `NodeAttempt` / `AttemptLineage`
   - `NodeAttemptReceipt`
   - `SideEffectRecord` / `ReconciliationRecord` / `CompensationRecord`
   - `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`
   - `RunVersionLock` / `ArtifactVersionLockSet`
   - `DecisionInputBundle` / `HarnessDecision`
   - `HumanResponsibilityRecord`
   - `EventEnvelope` / `PlatformFactEvent` / `OapeflirViewEvent`
3. Old names such as `ExecutionPlan`, `ExecutionReceipt`, `ControlDirective`, `StateCommand` are only allowed to appear as legacy adapter, deprecated alias, projection, or migration description, and must not be used as public contract for new modules.
4. Chinese documentation takes priority in freezing: first update `docs_zh/operations/current_todo_list.md`, then update `docs_zh/adr/` and `docs_zh/contracts/`, finally proceed to code implementation.
5. Previously Accepted historical ADRs will not rewrite body text; this ADR converges historical semantics through supersede relationship.

## Superseded or Constrained Historical Semantics

- ADR-021 inter-plane communication semantics continue to be retained, but cross-plane execution objects must use v4.3 canonical contract.
- ADR-029 OAPEFLIR semantics continue to be retained, but OAPEFLIR does not have independent execution authority.
- ADR-030 runtime execution plane continues to be retained, but state transition entry is defined by ADR-110 as `RuntimeStateMachine.transition(command)`.

## Consequences

- New implementations can establish contract naming consistency test to directly block old names from becoming canonical types.
- Contract documentation becomes pre-implementation gate for runtime objects; runtime objects without contract must not enter MVP main chain.
- Legacy APIs and legacy query tables can retain compatibility layer, but must clearly label projection / deprecated / legacy.

## Related Documents

- [00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [contracts/README.md](../contracts/README.md)
- [current_todo_list.md](../operations/current_todo_list.md)
