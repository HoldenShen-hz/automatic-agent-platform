# ADR-109: v4.3 Contract Freeze

## Status

Accepted

## Decision Date

2026-04-27

## Context

`docs_zh/architecture/00-platform-architecture.md` has consolidated v4.1 deep review, v4.2 pre-freeze corrections, and OAPEFLIR v4.4 executable spec into the v4.3 executable specification freeze scope. Previous ADRs and contracts still contain multiple sets of legacy naming conventions, including `ExecutionPlan`, `ExecutionReceipt`, `ControlDirective`, `StateCommand`, `workflow_run`, and linear `step` semantics. If these names continue to serve as implementation entry points, the runtime will form a second set of truth sources.

## Decision

1. v4.3 uses `§1.5 v4.3 Contract Freeze Scope` from `00-platform-architecture.md` as the freeze scope.
2. The first batch of implementations will only use the following 12 groups of contracts as canonical entry points:
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
3. Legacy names such as `ExecutionPlan`, `ExecutionReceipt`, `ControlDirective`, and `StateCommand` are only permitted to appear as legacy adapters, deprecated aliases, projections, or migration notes, and must not serve as public contracts for new modules.
4. Chinese documentation takes priority for freezing: first update `docs_zh/operations/current_todo_list.md`, then update `docs_zh/adr/` and `docs_zh/contracts/`, before entering code implementation.
5. Previously Accepted historical ADRs will not have their main text rewritten; this ADR consolidates historical semantics through supersession relationships.

## Historical Semantics Superseded or Constrained

- ADR-021's inter-plane communication semantics continue to be preserved, but cross-plane execution objects must use v4.3 canonical contracts.
- ADR-029's OAPEFLIR semantics continue to be preserved, but OAPEFLIR does not own independent execution authority.
- ADR-030's runtime execution plane continues to be preserved, but the state transition entry point is defined by ADR-110 as `RuntimeStateMachine.transition(command)`.

## Consequences

- New implementations can establish contract naming consistency tests that directly prevent old names from becoming canonical types again.
- Contract documentation becomes a pre-entry gate for code implementation; runtime objects without contracts must not enter the MVP main chain.
- Legacy APIs and legacy query tables may retain compatibility layers, but must be clearly marked as projection / deprecated / legacy.

## Related Documents

- [00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [contracts/README.md](../contracts/README.md)
- [current_todo_list.md](../operations/current_todo_list.md)
