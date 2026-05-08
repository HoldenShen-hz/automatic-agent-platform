# Edge Runtime And Sync Contract

## 1. Scope

This contract defines `§62` minimum edge runtime, offline execution constraints, and sync protocol.

## 2. Canonical Objects

- `EdgeRuntimeProfile`
- `OfflineExecutionRecord`
- `SyncEnvelope`
- `ConflictResolutionDecision`

## 3. `EdgeRuntimeProfile` Minimum Fields

- `edge_node_id`
- `stateful`
- `lease_migration_supported`
- `checkpoint_required_before_preempt`
- `capabilities`
- `connectivity_mode`
- `max_local_retention_hours`
- `allowed_models`
- `sync_policy`

Rules:

- Canonical edge runtime must explicitly declare `stateful = true` because offline execution holds local state, checkpoints, and pending sync evidence.
- `lease_migration_supported` must declare whether this edge runtime allows lease / ownership migration upon reconnection or preemption.
- If `checkpoint_required_before_preempt = true`, checkpoint must be completed before preemption, upgrade, or region takeover, and only then may local execution termination be allowed.

## 4. Rules

- Edge runtime defaults to minimum privileges.
- Side effects generated during offline period must be written to `OfflineExecutionRecord`.
- Reconnection sync must explicitly handle conflicts, replay, and ordering.
- If edge runtime holds active `NodeRun`, checkpoint / receipt / side-effect evidence must be submitted before releasing lease upon reconnection sync.

## 5. Test Requirements

- unit: sync envelope, conflict resolution
- integration: offline execute -> reconnect -> sync
- contract: edge nodes not meeting sync policy must not upload restricted data



## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-45: This document previously described edge runtime as a generic offline profile. Root cause: early edge documentation only focused on "can it sync" and did not write runtime hard constraints like stateful execution, lease migration, and pre-preemption checkpoint into the contract. Fix: The main text now adds `stateful / lease_migration_supported / checkpoint_required_before_preempt` to `EdgeRuntimeProfile` and supplements checkpoint/lease rules for when active `NodeRun` is held.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
