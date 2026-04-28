# Remote Coordination And Disaster Recovery Contract

---

## OAPEFLIR Relevance

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

This contract defines file consistency, remote execution observability, and cross-site disaster recovery boundaries for Bridge / Worker remote coordination scenarios.

Related documents:

- `execution_plane_contract.md`
- `ha_coordinator_and_leader_election_contract.md`
- `tenant_isolation_and_shared_worker_safety_contract.md`
- `production_storage_and_queue_contract.md`

## 2. Goals

- Make remote workers not just "able to connect", but have consistency and recoverability.
- Make cross-region coordination, worker disconnection, and sync breaks have formal recovery paths.
- Establish a source of truth for future coordinator clusters and region-level failover.

## 3. Remote File Consistency

Must define at minimum:

- Conflict detection
- Incremental validation
- Hash reconciliation
- Sync recovery after session disconnection
- Large file sync rate limiting
- Blocking execution rules after sync failure

## 4. Remote Execution Observability

Each remote worker must report at minimum:

- saturation
- active lease count
- mean startup latency
- sandbox success rate
- repo cache hit rate

Should also support at minimum:

- bridge credential refresh success rate
- stream resume success rate
- last acknowledged stream offset
- session consistency check result after reconnect

Remote session status must distinguish at minimum:

- `connecting`
- `connected`
- `reconnecting`
- `degraded`
- `failed`
- `viewer_only`

## 5. Disaster Recovery Capabilities

Mature industrial platforms should progressively support:

- Region-level failover
- Worker cross-region reassignment
- Metadata store primary/secondary switch
- Queue / lease repair

## 6. Key Invariants

- After remote worker disconnection, old leases must not continue writing back to authoritative state.
- File sync status must be verifiable, must not rely solely on "looked successful last time".
- After region-level switch, control plane must be able to determine which executions need rebuilding and which only need reconnecting.
- When sync hash inconsistency, repo version inconsistency, or lease ownership inconsistency occurs, execution must not continue by default.
- After bridge credential refresh, new epoch / session generation must override old transport's write permissions.
- Remote stream recovery should continue from acknowledged offset, not default to full replay.
- `viewer_only` sessions can consume logs and status, but must not send interrupts, approvals, dispatch, or write back to authoritative state.
- Transient reconnect and permanent disconnect must be explicitly distinguished at event and UI layers to avoid misjudging short-term jitter as final failure.

## 7. Topology Diagram

```mermaid
flowchart LR
    A["Primary Coordinator"] --> B["Primary Region Workers"]
    A --> C["Metadata / Queue"]
    D["Standby Coordinator"] --> E["Secondary Region Workers"]
    C --> D
```

## 8. Closure Conclusion

After remote coordination enters industrial-grade, the focus is no longer "can it dispatch" but:

- Whether files and state are consistent
- Whether workers are safely reclaimable after disconnection
- Whether region failure is controllable for switchover
- Whether inconsistency can be timely blocked, rebuilt, and given clear recovery paths

Supplementary notes:

- Currently only borrowing universal patterns from remote bridging such as token refresh, 401 recovery, and offset continuation.
- Not directly writing external system's proprietary session / bridge protocols as this system's source of truth.
