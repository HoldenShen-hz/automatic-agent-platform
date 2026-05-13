# ADR-109: v4.3 Contract Freeze

## Status

Accepted

## Decision Date

2026-04-27

## Context

`docs_zh/architecture/00-platform-architecture.md` has converged v4.1 deep review, v4.2 pre-freeze correction, and OAPEFLIR v4.4 executable spec into v4.3 executable spec freeze caliber. Past ADRs and contracts still contain multiple sets of historical naming, including `ExecutionPlan`, `ExecutionReceipt`, `ControlDirective`, `StateCommand`, `workflow_run`, and linear `step` semantics. If these names continue to serve as implementation entry points, the runtime will form a second truth source.

## Decision

1. v4.3 uses `00-platform-architecture.md` `§1.5 v4.3 Contract Freeze Scope` as the freeze scope.
2. The first batch of implementation only uses the following 12 groups of contracts as canonical entry points:
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
3. Old names such as `ExecutionPlan`, `ExecutionReceipt`, `ControlDirective`, `StateCommand` are only allowed to appear as legacy adapter, deprecated alias, projection, or migration description, and must not serve as public contract for new modules.
4. Chinese documentation is frozen first: update `docs_zh/operations/current_todo_list.md` first, then `docs_zh/adr/` and `docs_zh/contracts/`, finally enter code implementation.
5. Historically Accepted ADRs are not rewritten; this ADR collects historical semantics through supersede relationship.

## Superseded or Constrained Historical Semantics

- ADR-021 inter-plane communication semantics continue to be retained, but cross-plane execution objects must use v4.3 canonical contract.
- ADR-029 OAPEFLIR semantics continue to be retained, but OAPEFLIR does not own independent execution authority.
- ADR-030 runtime execution plane continues to be retained, but the status transition entry is defined by ADR-110 as `RuntimeStateMachine.transition(command)`.

## Consequences

- New implementation can establish contract naming consistency test, directly preventing old names from becoming canonical types again.
- Contract documents become pre-release gate for code implementation; runtime objects without contract must not enter MVP main chain.
- Old API and old query tables can retain compatibility layer but must clearly label projection / deprecated / legacy.

## Related Documents

- [00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [contracts/README.md](../contracts/README.md)
- [current_todo_list.md](../operations/current_todo_list.md)