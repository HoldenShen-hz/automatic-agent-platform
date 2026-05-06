# Edge Runtime And Sync Contract

## 1. Scope

This contract defines the minimum edge runtime for `§62`, offline execution constraints, and sync protocol.

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
- `run_version_lock_ref` (optional; offline nodes holding active NodeRun must associate RunVersionLock)

Rules:

- Canonical edge runtime must explicitly declare `stateful = true` because offline execution holds local state, checkpoints, and evidence pending sync.
- `lease_migration_supported` must declare whether this edge runtime allows lease / ownership migration during reconnection or preemption.
- If `checkpoint_required_before_preempt = true`, checkpoint must be completed before preemption, upgrade, or region takeover, then local execution termination is allowed.
- When offline nodes hold active `NodeRun`, they must associate `RunVersionLock` (§24/§25) to ensure configuration version freeze semantics; configuration release must not change the semantics of frozen runs, only through explicit GraphPatch, OperationalDirective, redrive, or new HarnessRun using new version.

## 4. Rules

- Edge runtime defaults to minimum privilege.
- Side effects generated during offline period must be written to `OfflineExecutionRecord`.
- Reconnection sync must explicitly handle conflicts, replay, and ordering.
- If edge runtime holds active `NodeRun`, must first submit checkpoint / receipt / side-effect evidence before releasing lease during reconnection sync.

## 5. Test Requirements

- unit: sync envelope, conflict resolution
- integration: offline execute -> reconnect -> sync
- contract: Edge nodes not meeting sync policy must not upload restricted data



## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-45: This document originally described edge runtime as a generic offline profile. Root cause: early edge documentation only focused on "whether it can sync", without writing runtime hard constraints like stateful execution, lease migration, and preemption checkpoint into the contract. Fix: The text now adds `stateful / lease_migration_supported / checkpoint_required_before_preempt` to `EdgeRuntimeProfile`, and adds checkpoint/lease rules for when holding active `NodeRun`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
