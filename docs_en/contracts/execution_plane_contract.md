# Execution Plane Contract

> **OAPEFLIR Related**: This contract defines the execution plane for OAPEFLIR Execute Hub, corresponding to ADR-016 Execute stage and ADR-079 Feedback Hub.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines the target architecture for the platform's evolution from single-machine runtime to multi-execution plane, including scheduling, dispatch, lease, worker liveliness, takeover, recovery, and execution authority governance.

It is the upper-level extension of `runtime_execution_contract.md` and answers "when execution no longer runs only in a single process, how does the platform remain controllable, recoverable, and auditable".

## 2. Goals

- Formally separate `control plane` from `execution plane`.
- Enable execution to be scheduled, recovered, and taken over across workers.
- Ensure stale run, failover, handover, and takeover have unified semantics.
- Ensure only one authoritative execution authority holder exists in multi-worker environment.

## 3. Non-Goals

- Phase 1a does not require a full distributed queue cluster.
- This contract does not specify specific queue backend product selection.
- This contract does not replace single-run state machine and execution semantics definition.

## 4. Architecture Layers

`Task / Workflow Layer`
: Responsible for task generation, workflow orchestration, approval wait, and result writeback.

`Execution Control Plane`
: Responsible for dispatch, lease, route, capacity awareness, recovery decision.

`Execution Worker Plane`
: Responsible for actually consuming execution tickets, executing runs, reporting heartbeats and results.

`Recovery And Governance Hooks`
: Responsible for stale detection, takeover proposal, kill / freeze / retry decision linkage.

`Plan / Feedback Boundary (OAPEFLIR)`
: Plan Hub produces `Plan` DTO into execution plane; after execution, execution plane writes `DualChannelStepOutput` and `FeedbackSignal` back to Feedback Hub (corresponding to ADR-079).

## 5. Key Components

- `ExecutionControlPlane`
- `DispatchQueue`
- `LeaseCoordinator`
- `ExecutionWorker`
- `RecoveryCoordinator`
- `WorkerRegistry`
- `WorkerHeartbeat`
- `TakeoverManager`
- `Plan` (OAPEFLIR Plan Hub output)
- `FeedbackSignal` (OAPEFLIR Feedback Hub input)

## 6. Target Architecture

```mermaid
flowchart LR
    A["Task / Workflow Layer"] --> B["Execution Control Plane"]
    B --> C["Dispatch Queue"]
    C --> D["Execution Worker"]
    D --> E["Runtime Execution"]
    E --> F["EventBus"]
    E --> G["Storage"]
    E --> H["Result Writeback"]
    B --> I["Lease Coordinator"]
    B --> J["Recovery Coordinator"]
    D --> K["Worker Heartbeat"]
    K --> B
    J --> C
```

Supplementary notes:

- `ExecutionControlPlane` is responsible for deciding "who should execute".
- `ExecutionWorker` is responsible for executing "runs that have been authorized to execute".
- `LeaseCoordinator` is responsible for ensuring only one worker holds the same execution at the same time.
- `RecoveryCoordinator` is responsible for scanning stale executions and deciding recovery, retry, takeover, or dead letter.

## 6.1 Execution Plane Layered Diagram

```mermaid
flowchart TD
    subgraph L1["Task / Workflow Layer"]
        A1["Task Creation"]
        A2["Workflow Orchestration"]
        A3["Approval Wait"]
    end

    subgraph L2["Execution Control Plane"]
        B1["Dispatch Decision"]
        B2["Queue Routing"]
        B3["Lease Coordination"]
        B4["Recovery Decision"]
    end

    subgraph L3["Execution Worker Plane"]
        C1["Worker Registry"]
        C2["Worker Runtime"]
        C3["Execution Heartbeat"]
    end

    subgraph L4["Persistence / Observability"]
        D1["Execution Storage"]
        D2["Event Stream"]
        D3["Audit / Metrics"]
    end

    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L2
```

## 7. Key Objects

- `ExecutionTicket`
- `DispatchDecision`
- `LeaseRecord`
- `WorkerSnapshot`
- `RecoveryDecision`
- `TakeoverProposal`
- `WorkerCapabilitySet`

## 8. `ExecutionTicket` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `ticket_id` | `string` | Dispatch ticket ID |
| `execution_id` | `string` | Target execution |
| `task_id` | `string` | Associated task |
| `plan_ref` | `string?` | Associated PlanDTO or execution graph reference |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Closed-loop stage that generated this ticket |
| `priority` | `low \| normal \| high \| urgent` | Scheduling priority |
| `queue_name` | `string` | Target queue |
| `required_capabilities` | `string[]` | Required worker capabilities |
| `dispatch_target` | `any \| local_only \| prefer_remote \| require_remote` | Dispatch target strategy |
| `required_isolation_level` | `standard \| hardened \| strict` | Minimum isolation level requirement |
| `required_repo_version?` | `string` | Required worker code version match |
| `dispatch_after` | `timestamp?` | Earliest dispatch time |
| `attempt` | `integer` | Attempt count associated with this ticket |
| `created_at` | `timestamp` | Creation timestamp |

### 8.1 Dispatch Target Semantics

| Strategy | Meaning |
| --- | --- |
| `any` | No preference on worker deployment location; both local and remote acceptable |
| `local_only` | Only local worker execution allowed; remote workers excluded |
| `prefer_remote` | Prefer remote worker; if no remote worker available, downgrade to local |
| `require_remote` | Must be remote worker; if no remote worker available, fail-closed (no downgrade) |

Rules:

- When `require_remote` and remote workers are partially available, dispatch should return `remote.partial_available` and reject, not downgrade to local.
- Dispatch target is determined by ticket creator (orchestrator / operator), must not be modified by worker.

### 8.2 Isolation Level Semantics

Worker isolation levels are ordered: `standard (0) < hardened (1) < strict (2)`.

| Level | Meaning |
| --- | --- |
| `standard` | Standard sandbox |
| `hardened` | Hardened sandbox (extra network/filesystem restrictions) |
| `strict` | Strict isolation (least privilege) |

Rules:

- High-risk execution may declare `required_isolation_level`; worker's actual isolation level must be >= required level to accept.
- When isolation level not met, dispatch should record rejection reason in decision trace.

### 8.3 Repo Version Consistency

- Execution ticket may declare `required_repo_version`.
- Worker heartbeat reports `repoVersion`.
- If version mismatch, dispatch defaults to fail-closed and records rejection.

### 8.4 General Rules

- One execution under the same attempt should correspond to only one active ticket.
- Ticket after invalidation must not be consumed by worker again.
- Authoritative input to execution plane should come from `PlanDTO`, not from unstructured prompt stitching alone.

## 8A. OAPEFLIR Plan -> Execute -> Feedback Boundary

### 8A.1 Plan Hub -> Execute (corresponding to ADR-060)

When `Plan` enters execution plane, minimum should provide (corresponding to ADR-060 §2):

- `planId`
- `taskId`
- `version`
- `strategy`
- `steps[]` (DAG nodes)
- `dag` (dependency structure)
- `retryPolicy`
- `estimatedCost`
- `estimatedDuration`

**R3 Constraints** (ADR-060 §3):
- Execute layer can only receive Plan DTO; no bypass to raw task direct execution (R3-NOBYPASS)
- Plan version chain must maintain stable lineage; must not be silently overwritten by new worker

### 8A.2 Execute -> Feedback Hub (corresponding to ADR-079)

After execution plane completes a single run, besides `DualChannelStepOutput` should also produce:

- `FeedbackSignal[]`
- `artifact_refs[]`
- `policy_decision_ref?`
- `rollout_evidence_ref?`

**Rules** (corresponding to ADR-079 §4):

- `FeedbackSignal` is the formal output from Execute to Feedback; must not be side-loaded through logs only.
- If some run produces no feedback, should explicitly record `feedback_count=0` or equivalent evidence, to avoid subsequent Learn / Improve misjudging missing chain.
- FeedbackSignal must be associated with original Plan version and executionId (for Learn Hub evidence linking, R4-EVIDENCE constraint)

## 9. `LeaseRecord` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `lease_id` | `string` | Lease ID |
| `execution_id` | `string` | Target execution |
| `worker_id` | `string` | Current holder |
| `acquired_at` | `timestamp` | Acquisition timestamp |
| `expires_at` | `timestamp` | Expiration timestamp |
| `last_heartbeat_at` | `timestamp?` | Last renewal timestamp |
| `status` | `active \| expired \| released \| reclaimed \| handed_over` | Lease status (aligned with `task_lease_and_fencing_contract.md` §5) |

Rules:

- At any moment, only one `active` lease for the same `execution_id`.
- Worker must not execute side-effect steps without obtaining active lease.
- After lease expires, original worker loses execution authority even if local process is still alive.

## 10. `WorkerSnapshot` Minimum Fields

- `worker_id`
- `status` (`idle | busy | draining | degraded | unavailable | quarantined | offline`)
- `capabilities`
- `running_executions`
- `last_heartbeat_at`
- `max_concurrency`
- `queue_affinity?`
- `isolation_level` (`standard | hardened | strict`)
- `saturation` (load saturation)
- `repo_version?`
- `remote_session_status?` (`connecting | connected | reconnecting | degraded | failed | viewer_only`)
- `last_acknowledged_stream_offset?`
- `resume_ready?`
- `credential_expiry_at?`
- `consistency_check_status?` (`passed | failed | pending`)
- `runtime_instance_id?`
- `restart_generation?` (restart generation)
- `parent_runtime_instance_id?`

### 10.1 Worker Status Semantics

| status | Meaning | Can Accept New Dispatch |
| --- | --- | --- |
| `idle` | Idle, no task in progress | Yes |
| `busy` | Task in progress, not saturated | Yes (constrained by max_concurrency) |
| `draining` | Under maintenance; can finish current tasks, not accepting new ones | No |
| `degraded` | Partial capability degradation (e.g., provider timeout, memory pressure) | Depends |
| `unavailable` | Currently unserviceable (e.g., network partition, dependency failure) | No |
| `quarantined` | Isolated due to anomaly (e.g., consecutive failures, security incident) | No |
| `offline` | Heartbeat timeout or active offline | No |

### 10.2 Worker Scheduling Projection

Scheduling layer projects 7 worker statuses into a simplified scheduling view:

| Scheduling Status | Corresponding worker status |
| --- | --- |
| `healthy` | `idle`, `busy` (and other unmapped statuses) |
| `degraded` | `degraded` |
| `draining` | `draining` |
| `quarantined` | `quarantined` |
| `offline` | `offline` |
| `unavailable` | `unavailable` |

Rules:

- Scheduling layer only consumes projected scheduling status, does not directly read worker internal status.
- `healthy` is the only scheduling status allowed to accept new dispatch (constrained by capacity and capability).

## 11. `RecoveryDecision` Minimum Fields

- `decision_id`
- `execution_id`
- `reason`
- `action` (`resume_same_worker | retry_new_ticket | escalate_takeover | move_dead_letter | cancel`)
- `decided_at`
- `decided_by`

Rules:

- Recovery decision must be auditable.
- Recovery decision must not bypass approval, budget, and policy boundaries.

## 12. Execution Lifecycle

Standard lifecycle for multi-execution plane:

1. `execution` registered by control plane.
2. Control plane generates `ExecutionTicket`.
3. Ticket enters target `DispatchQueue`.
4. Worker claims lease and consumes ticket.
5. Worker enters actual execution after obtaining lease.
6. Worker periodically sends heartbeat / lease renew.
7. After run ends, write back result and release lease.
8. If lease expires, worker disappears, or run is stuck, enter recovery scan.

### 12.1 Lifecycle Flowchart

```mermaid
flowchart TD
    A["Register Execution"] --> B["Create ExecutionTicket"]
    B --> C{"Dispatch After Reached?"}
    C -- "No" --> B
    C -- "Yes" --> D["Worker Claims Ticket"]
    D --> E{"Lease Acquired?"}
    E -- "No" --> C
    E -- "Yes" --> F["Run Execution"]
    F --> G["Heartbeat / Renew Lease"]
    G --> H{"Completed?"}
    H -- "Yes" --> I["Write Back Result"]
    I --> J["Release Lease"]
    H -- "No" --> K{"Lease Stale / Worker Lost?"}
    K -- "No" --> G
    K -- "Yes" --> L["Recovery Scan"]
    L --> M["Resume / Retry / Takeover / Dead Letter"]
```

## 13. Dispatch Rules

- Queue selection considers at least: priority, capability, isolation level, queue congestion.
- Worker with unmet `required_capabilities` must not claim ticket.
- High-risk execution may require entering specific queue or specific worker class.
- Ticket must not be consumed before `dispatch_after` time.

## 14. Lease And Heartbeat Rules

- Lease defaults to short TTL; relies on heartbeat for renewal.
- Heartbeat loss does not directly equal execution failure; triggers recovery candidate.
- Stale determination should combine `lease.expires_at` with worker heartbeat.
- Worker heartbeat and execution heartbeat are different levels:
  - Worker heartbeat indicates worker liveness and capacity.
  - Execution heartbeat indicates progress and liveness of some run.

## 15. Handover / Takeover Rules

`handover`
: Controlled transfer of execution authority within system, e.g., original worker is about to go offline.

`takeover`
: Forcibly transferring execution to a new execution subject or human process due to anomaly, human takeover, or governance needs.

Rules:

- Handover must record old lease, new lease, and lineage.
- Takeover must generate `TakeoverProposal` or governance decision record.
- Takeover must not occur silently; must be traceable to cause and trigger.

## 16. Failure Mode

Main failure modes:

- Worker crashes but lease does not expire in time.
- Worker network isolation causes false liveness.
- Ticket consumed but result not written back.
- Lease expired but old worker continues execution.

Handling rules:

- Authoritative result is based on control plane + storage, not worker local memory.
- When old worker continues writeback after lease invalidation, should be identified as stale write and rejected or degraded.
- Recovery scan should identify at least three types of anomalies: `running but stale`, `ticket lost`, `duplicate claimant`.

## 17. Relationship With Storage And Governance

- `runtime_repository_and_migration_contract.md` should add repository for lease / queue / worker registry in the future.
- `governance_control_plane_contract.md` constrains governance paths for freeze / kill / takeover.
- `storage_schema_contract.md` continues to be responsible for `executions` authoritative baseline; execution plane only adds scheduling layer on top.

## 18. Implementation Sequence

- Phase 1b: Minimum queue + stale detection + worker registry.
- Phase 2a: Lease / failover / handover.
- Phase 2b: Capacity-aware scheduling + recovery policy.
- Phase 4: Enterprise multi-environment execution fleet.

## 19. Closure Conclusion

The core of execution plane is not "moving execution to multiple processes", but formally modeling execution authority, recovery authority, and scheduling authority.

Current platform has single-machine runtime baseline; after completing this contract, subsequent implementation should use "control plane and worker plane separation" as the sole evolution direction.