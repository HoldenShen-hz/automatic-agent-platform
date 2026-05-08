# ADR-109: v4.3 Contract Freeze

## Status

Accepted

## Decision Date

2026-04-27

## Context

`docs_zh/architecture/00-platform-architecture.md` has converged the v4.1 deep review, v4.2 pre-freeze corrections, and OAPEFLIR v4.4 executable spec into the v4.3 executable specification freeze scope. Prior ADRs and contracts still contain multiple legacy naming conventions, including `ExecutionPlan`, `ExecutionReceipt`, `ControlDirective`, `StateCommand`, `workflow_run`, and linear `step` semantics. If these names continue to serve as implementation entry points, the runtime will form a second truth source.

## Decision

1. v4.3 uses `§1.5 v4.3 Contract Freeze Scope` from `00-platform-architecture.md` as the freeze scope.
2. The first wave of implementations shall only use the following 12 contract groups as canonical entry points:
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
3. Legacy names such as `ExecutionPlan`, `ExecutionReceipt`, `ControlDirective`, `StateCommand` are only permitted to appear as legacy adapters, deprecated aliases, projections, or migration notes, and shall not serve as public contracts for new modules.
4. Chinese documentation takes priority for freezing: first update `docs_zh/operations/current_todo_list.md`, then `docs_zh/adr/` and `docs_zh/contracts/`, and finally proceed to code implementation.
5. Accepted historical ADRs shall not have their body text directly rewritten; this ADR converges historical semantics through supersede relationships.

## Superseded or Constrained Historical Semantics

- ADR-021's inter-plane communication semantics remain valid, but cross-plane execution objects must use v4.3 canonical contracts.
- ADR-029's OAPEFLIR semantics remain valid, but OAPEFLIR does not hold independent execution authority.
- ADR-030's runtime execution plane remains valid, but the state transition entry point is defined by ADR-110 as `RuntimeStateMachine.transition(command)`.

## Consequences

- New implementations may establish contract naming consistency tests to directly prevent legacy names from becoming canonical types.
- Contract documentation becomes a pre-implementation gate; runtime objects without contracts shall not enter the MVP main chain.
- Legacy APIs and legacy query tables may retain compatibility layers, but must clearly mark projection / deprecated / legacy.

## Related Documents

- [00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [contracts/README.md](../contracts/README.md)
- [current_todo_list.md](../operations/current_todo_list.md)