# Task Lease And Fencing Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines task lease, renewal, reclaim, and fencing token rules in the industrial-grade execution plane.

It answers the question: When `NodeRun` is dispatched to a worker, how does the system ensure only the current legitimate holder can continue writing results, avoiding double-write, dirty-write, and stale worker write-back.

Related documents:

- `runtime_execution_contract.md`
- `execution_plane_contract.md`
- `storage_schema_contract.md`
- `distributed_locking_contract.md`

## 2. Objectives

- Establish authoritative lease for each active `NodeRun`.
- Use `visibility timeout` and `lease renew` to control execution rights lifecycle.
- Use `fencing token` to reject old worker write-back.
- Let recovery, takeover, retry, and dead letter enter the unified chain.

## 3. Non-Objectives

- This contract does not specify specific queue products.
- This contract does not replace the task main state machine.
- Phase 1a does not require complete distributed deployment, but the contract is defined from the start with multi-worker semantics.

## 4. Key Objects

- `LeaseGrant`
- `LeaseRenewal`
- `LeaseReclaimDecision`
- `FencingToken`
- `StaleWriteRejection`
- `QueueDispatchRecord`
- `LeaseAuditRecord`
- `LeaseReconciliationRecord`

## 5. `LeaseGrant` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `lease_id` | `string` | Lease ID |
| `node_run_id` | `string` | Target `NodeRun` |
| `worker_id` | `string` | Current holder |
| `attempt_id` | `string` | Associated `NodeAttempt` |
| `fencing_token` | `integer` | Monotonically increasing execution rights version |
| `leased_at` | `timestamp` | Acquisition time |
| `expires_at` | `timestamp` | Current expiration time |
| `status` | `active \| expired \| released \| reclaimed \| handed_over` | Lease status (`handed_over` see §8A lease handover, aligned with `execution_plane_contract.md` §9) |

Rules:

- The same `node_run_id` can only have one `active` lease at any moment.
- Each time a lease is re-granted after redispatch, takeover, or reclaim, `fencing_token` must increment.
- Any side-effect writes must carry the current `fencing_token`.

## 6. Lifecycle

```mermaid
flowchart TD
    A["Dispatch Ticket"] --> B["Acquire Lease"]
    B --> C["Grant Fencing Token"]
    C --> D["Run Execution"]
    D --> E["Renew Lease"]
    E --> F{"Completed?"}
    F -- "Yes" --> G["Release Lease"]
    F -- "No" --> H{"Lease Expired / Worker Lost?"}
    H -- "No" --> E
    H -- "Yes" --> I["Reclaim Lease"]
    I --> J["New Ticket / New Lease"]
```

## 7. Renewal and Reclaim

- Worker must complete renewal before `expires_at`.
- After continuous renewal failures reach the threshold, lease enters `expired` and original worker loses execution rights.
- Reclaim action must record `reason_code`, such as:
  - `heartbeat_missing`
  - `worker_disconnected`
  - `worker_unhealthy`
  - `operator_takeover`
  - `budget_forced_stop`

## 8. Fencing Token Rules

- `fencing_token` is the `NodeRun` write permission version number, not a display field.
- Storage layer updates to `NodeRun`, artifact, tool result, side-effect receipt must compare token.
- Writes smaller than current authoritative token must be rejected and record `stale_write_rejected` audit event.
- Even if old lease cached locally by worker has not yet perceived expiration, it must not be accepted by the system.

## 8A. Lease Handover

### 8A.1 Semantics

Handover refers to a controlled operation where, without interrupting execution, the current worker actively transfers the lease to a new worker. Unlike passive reclaim after lease expiration, handover is collaborative and traceable.

### 8A.2 `HandoverExecutionLeaseInput`

| Field | Type | Description |
| --- | --- | --- |
| `leaseId` | `string` | Current active lease |
| `workerId` | `string` | Original worker (must be current holder) |
| `newWorkerId` | `string` | Target worker |
| `ttlMs` | `number` | New lease TTL |
| `reasonCode?` | `string` | Handover reason (e.g., `worker_draining`, `load_rebalance`, `upgrade_migration`) |

### 8A.3 `ExecutionLeaseHandoverDecision`

| Field | Type | Description |
| --- | --- | --- |
| `outcome` | `handed_over \| blocked` | Result |
| `reasonCode` | `string?` | If blocked, reason code |
| `previousLease` | `ExecutionLeaseRecord?` | Original lease (marked `released`) |
| `lease` | `ExecutionLeaseRecord?` | New lease (new fencing token) |

### 8A.4 Rules

- Handover must complete in a single transaction: release old lease -> create new lease -> increment fencing token -> update execution owner and worker snapshot.
- Only `active` status lease can handover.
- Old lease's `workerId` must match the `workerId` in the request.
- After handover completes, must write `lease_audit` (event_type: `handover`), recording source worker, target worker, and lineage.
- Handover failure should not cause execution to become ownerless.

### 8A.5 Typical Scenarios

| Scenario | Trigger | reasonCode |
| --- | --- | --- |
| Worker enters draining | Worker itself | `worker_draining` |
| Load rebalancing | Control plane | `load_rebalance` |
| Rolling upgrade | Operations | `upgrade_migration` |
| Operations主动切换 | Operator | `operator_handover` |

## 9. Relationship with Recovery Chain

- Lease expiration does not equal task failure.
- After lease expiration, system should enter recovery judgment:
  - `resume_same_worker`
  - `retry_new_ticket`
  - `manual_takeover`
  - `move_dead_letter`

## 10. Queue Binding and Audit

`QueueDispatchRecord` minimum fields:

- `dispatch_id`
- `node_run_id`
- `queue_name`
- `enqueued_at`
- `dequeued_at?`
- `worker_id?`
- `lease_id?`
- `status` (`queued | dequeued | leased | completed | abandoned`)

`LeaseAuditRecord` minimum fields:

- `audit_id`
- `node_run_id`
- `lease_id`
- `worker_id`
- `event_type` (`lease_granted | lease_renewed | lease_expired | lease_reclaimed | stale_write_rejected | lease_released`)
- `reason_code?`
- `recorded_at`

Rules:

- Dispatch, lease, and final write permission rejection must be traceable as an audit chain.
- Queue status answers "whether task has been dispatched, has been picked up, has obtained lease".
- Stale write rejection must write to lease audit, not just fall into temporary logs.

## 11. Reconciliation

`LeaseReconciliationRecord` minimum fields:

- `reconciliation_id`
- `node_run_id`
- `lease_id`
- `issue_type` (`stale_lease | duplicate_owner | replay_recovery_needed | orphan_queue_claim`)
- `detected_at`
- `resolution_action` (`extend | release | reclaim | handover | block_for_manual`)
- `resolved_at?`

### 11.1 Dispatch Reconciliation Scan

Reconciliation service scans all `pending` or `claimed` status `NodeRun` dispatch tickets and detects the following anomalies:

| issue_type | Detection Condition | Fix Action |
| --- | --- | --- |
| `execution_terminal` | Ticket's associated execution has reached terminal state (`succeeded / failed / cancelled / superseded`) | Invalidate ticket (do not generate replacement ticket) |
| `missing_active_lease` | Ticket has been claimed but no active lease | Invalidate old ticket + create replacement ticket (requeue) |
| `lease_ticket_mismatch` | Lease's leaseId or workerId does not match ticket | Invalidate old ticket + create replacement ticket |
| `lease_expired_unreclaimed` | Lease has passed `expires_at` but was not reclaimed | Invalidate old ticket + create replacement ticket |

### 11.2 Requeue Semantics

Replacement ticket inherits the following attributes from the original ticket:

- `node_run_id`, `priority`, `queue_name`
- `dispatch_target`, `required_isolation_level`, `required_capabilities`
- `dispatch_after`

Replacement ticket resets: `status = pending`, new `ticket_id`, new `created_at`.

### 11.3 Reconciliation Events

| Event | Meaning |
| --- | --- |
| `dispatch:ticket_reconciled` | Ticket invalidated due to issue |
| `dispatch:ticket_requeued` | New replacement ticket created |

Both are emitted atomically in the same transaction; event payload must contain `issueType` and `reasonCode`.

### 11.4 Rules

- System must periodically scan stale lease, duplicate owner, and orphan queue claim.
- Reconciliation is an authoritative repair action and must not rely solely on manual log investigation.
- After duplicate owner resolution, must explicitly record winner and write stale/fenced result for loser.
- Terminal execution tickets are only invalidated, not requeued, to avoid creating invalid tickets for completed executions.

## 12. Consistency Requirements

Industrial-grade minimum consistency requirements:

- `NodeRun` current lease: strong consistency
- Fencing token comparison: strong consistency
- Heartbeat display: eventual consistency
- Worker UI status: eventual consistency

## 13. Phase Boundaries

Phase 1a / 1b:

- Allow single-instance control plane
- Allow lease authoritative store to temporarily fall under SQLite/PG abstraction
- Must first solidify token semantics and stale write rejection

Phase 2+:

- Expand to multi-worker, multi-queue, multi-tenant isolation

## 14. Conclusion

Lease solves "who can execute now", fencing token solves "who can write results now".

Industrial-grade systems must have both layers simultaneously to avoid repeated execution and old results overwriting new results.

## 15. Legacy / Deprecated Mapping

| Legacy Name | New Semantics |
| --- | --- |
| `execution_id` | Legacy queue / repository field; v4.3 canonical objects should map to `node_run_id` |
| `attempt` | Legacy attempt sequence number; v4.3 canonical objects should map to `attempt_id` / `NodeAttempt` |
| `task lease` | Only retains narrative semantics; authoritative object is `NodeRun` lease


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-6: Uses deprecated term execution_id, architecture v4.0 unified to node_run_id. Root Cause: This document followed v3 execution-centric queue/lease terminology but did not update synchronously with `HarnessRun` / `NodeRun` authoritative object migration. Fix: `LeaseGrant`, `QueueDispatchRecord`, `LeaseAuditRecord`, `LeaseReconciliationRecord` and requeue semantics have all converged to `node_run_id` / `attempt_id`; `execution_id` only retains as legacy mapping description.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.