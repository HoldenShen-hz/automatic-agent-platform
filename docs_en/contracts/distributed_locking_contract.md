# Distributed Locking Contract

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

This contract defines lock semantics for industrial-grade platform deployments, including local locks, database locks, lease locks, and approval mutex locks.

The problem it solves: which locks are valid only within a single process, which locks must guarantee cross-worker consistency, and which operations can only rely on lease rather than general-purpose locks.

Related documents:

- `file_lock_contract.md`
- `task_lease_and_fencing_contract.md`
- `production_storage_and_queue_contract.md`

## 2. Lock Classification

| Lock Type | Authoritative Backend | Primary Use Case |
| --- | --- | --- |
| `local_mutex` | process memory | Single-process cache refresh, singleton initialization protection |
| `file_lock` | authoritative store | File read/write mutual exclusion |
| `execution_lease` | authoritative store | Execution ownership |
| `approval_lock` | authoritative store | Approval object serial updates |
| `advisory_lock` | PostgreSQL | Short-transaction mutual exclusion, repair/migration/compaction serialization |

## 3. Key Principles

- Local locks must not be mistaken for distributed locks.
- Execution ownership should preferentially use lease + fencing, not ordinary mutex as substitute.
- Write locks must have TTL, renewal, recovery, and owner identification.
- Lock failures must be observable, alertable, and recoverable.
- Lock state transitions that affect truth must go through the unified state write entry point; they must not be scattered across callers.

## 4. Recommended Solutions

- Short-transaction mutual exclusion: PostgreSQL advisory lock
- Long-lifecycle execution ownership: lease + fencing token
- File mutual exclusion: authoritative file lock repository
- Redis locks are not the current preferred source of truth; if Redlock is adopted in the future, an additional ADR must describe the risk boundaries

## 5. Lock State Machine

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> active
    active --> renewed
    renewed --> active
    active --> released
    active --> expired
    expired --> reclaimed
    released --> [*]
    reclaimed --> [*]
```

Description:

- The above state machine only describes the resource lifecycle of `LockRecord` / `LeaseRecord`, not a second set of truth mutation entries independent of the runtime state machine.
- Any truth changes related to `execution_lease`, `approval_lock`, or system maintenance locks must go through the unified command entry point to persist and append factual events.

### 5.1 LockTransitionCommand

`LockTransitionCommand` minimum fields:

- `lock_id`
- `lock_type`
- `resource_key`
- `from_status`
- `to_status`
- `owner_id`
- `reason_code`
- `trace_id`
- `occurred_at`
- `fencing_token?`

Rules:

- Acquisition, renewal, expiration, and recovery of `execution_lease` must work in coordination with `RuntimeStateMachine.transition(command)`; lease state must not bypass the unified state write entry point for direct modification.
- For `execution_lease`, lock state transitions must maintain the same truth boundary as lease/fencing validation for `NodeRun` / `NodeAttempt`.
- `approval_lock`, `file_lock`, `advisory_lock` that affect audit or system maintenance truth must also record through append-only events and audit chains.

## 6. Required Fields

- `lock_id`
- `lock_type`
- `resource_key`
- `owner_kind`
- `owner_id`
- `expires_at`
- `fencing_token?`
- `created_at`
- `updated_at`

## 7. Rules

- Any distributed write lock must support expiration detection.
- Lock acquisition failure must return a clear `reason_code`, not just `false`.
- Lock release must verify owner to avoid accidentally releasing others' locks.
- Lock recovery actions must produce logs and audit events.
- `execution_lease` state transitions must not become a RuntimeStateMachine bypass; if needed to drive `NodeRun` recovery, failure, or takeover, it must be done through unified state machine commands.

## 8. Applicability Boundaries

Scenarios where distributed locks should NOT be used:

- Side-effect-free deduplication of local memory objects only
- Read-only tasks that are idempotent and repeatable

Scenarios where authoritative distributed locks or lease MUST be used:

- File writes
- Execution main write chain
- Approval final verdict
- System-level maintenance actions such as migration/repair/reindex

## 9. Fault Handling

- After lock expiration, the original owner must not continue writing.
- If network partition causes owner to believe they still hold the lock, the authoritative backend still uses the current latest token as authoritative.
- Abnormal lock table bloat or expired lock accumulation should trigger operations alerts.

## 10. Closure Conclusion

The focus of industrial-grade lock design is not "add locks everywhere," but first distinguishing:

- Local mutual exclusion
- Distributed resource locks
- Execution lease

Only with clear boundaries can the system be both secure and not dragged down by lock design.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If earlier sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-31: This document originally described the lock state machine as an independent self-consistent lifecycle, without explaining how it belongs to the unified state write entry point. Root cause: Early lock contracts treated lease/lock as infrastructure details, ignoring that once they affect execution ownership, they enter the runtime truth boundary. Fix: The main text now includes `LockTransitionCommand`, and clarifies that `execution_lease` state transitions must coordinate with `RuntimeStateMachine.transition(command)` and cannot become a bypass state machine.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.