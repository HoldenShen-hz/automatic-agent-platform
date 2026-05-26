# Edge Runtime And Sync Contract

## 1. Scope

This contract defines the minimum edge runtime for `§62`, offline execution constraints and sync protocol.

## 2. Canonical Objects

- `EdgeDeploymentMode`
- `EdgeRuntimeProfile`
- `OfflineExecutionRecord`
- `SyncEnvelope`
- `ConflictResolutionDecision`

`EdgeDeploymentMode` allows the following classification:

- `edge_micro`
- `edge_standard`
- `edge_mobile`
- `edge_hybrid`

## 3. `EdgeRuntimeProfile` Minimum Fields

- `edge_node_id`
- `stateful`
- `lease_migration_supported`
- `checkpoint_required_before_preempt`
- `capabilities`
- `connectivity_mode`
- `deployment_mode?`
- `max_local_retention_hours`
- `allowed_models`
- `sync_policy`

Rules:

- Canonical edge runtime must explicitly declare `stateful = true` because offline execution holds local state, checkpoint and pending sync evidence.
- `lease_migration_supported` must declare whether this edge runtime allows lease / ownership migration on reconnect or preemption.
- If `checkpoint_required_before_preempt = true`, checkpoint must be completed before preemption, upgrade or region takeover, then local execution termination allowed.
- If `deployment_mode` is not explicitly provided, runtime must automatically resolve to one of `edge_micro | edge_standard | edge_mobile | edge_hybrid` based on capability / connectivity, to avoid edge run state being unclassified.

## 4. Rules

- Edge runtime defaults to minimum privilege.
- Side effects generated during offline period must be written to `OfflineExecutionRecord`.
- Reconnect sync must explicitly handle conflict, replay and ordering.
- If edge runtime holds active `NodeRun`, must submit checkpoint / receipt / side-effect evidence before releasing lease on reconnect sync.

## 5. Test Requirements

- unit: sync envelope, conflict resolution
- integration: offline execute -> reconnect -> sync
- contract: edge nodes not meeting sync policy must not upload restricted data



## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-45: This document originally described edge runtime as a general offline profile. The root cause was early edge copy only focused on "whether it can sync", without writing the runtime hard constraints of stateful execution, lease migration and pre-checkpoint into the contract. Fix: This document now adds `stateful / lease_migration_supported / checkpoint_required_before_preempt` to `EdgeRuntimeProfile`, and supplements checkpoint/lease rules when holding active `NodeRun`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
