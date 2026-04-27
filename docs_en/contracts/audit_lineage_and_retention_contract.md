# Audit Lineage And Retention Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-phase loop:

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

This contract defines industrial-grade auditing, evidence chains, data retention, and deletion strategies.

Related Documents:

- `data_classification_and_prompt_handling_contract.md`
- `storage_schema_contract.md`
- `tenant_and_organization_contract.md`

## 2. Goals

- Make key behaviors traceable to people, systems, versions, and policies.
- Enable enterprises to export evidence chains.
- Make retention / deletion not just a slogan, but with objects, time limits, and exception rules.

## 3. Evidence Chain Objects

- `model_version_evidence`
- `prompt_version_evidence`
- `policy_decision_evidence`
- `approval_evidence`
- `data_lineage_evidence`
- `release_bundle_evidence`
- `strategy_version_evidence`
- `rollout_evidence`
- `feedback_lineage_evidence`
- `knowledge_provenance_evidence`
- `memory_promotion_evidence`

## 4. Audit Subjects

Unified actor model:

- `user`
- `agent`
- `system`
- `scheduler`
- `admin`
- `webhook`
- `recovery`

Note: `recovery` represents changes automatically triggered by recovery chain (recovery coordinator, stale lease recycling, reconciliation scanning, etc.). The difference from `system` is: `system` is normal runtime system behavior, `recovery` is system behavior in the exception recovery path. Both should be distinguishable in auditing and alerting.

## 5. Minimum Audit Fields

- `audit_id`
- `actor_type`
- `actor_id`
- `tenant_id?`
- `workspace_id?`
- `task_id?`
- `execution_id?`
- `action`
- `resource_ref`
- `decision_ref?`
- `version_ref?`
- `created_at`

## 6. Data Retention Tiering

| Data Type | Minimum Requirements |
| --- | --- |
| task / execution core records | Longer than business recourse window |
| audit log | Longer than security audit window |
| artifact | Retained per business and compliance policy |
| PII derived data | Must support deletion SLA |
| backup | Must have deletion and legal preservation exception rules |

### 6.1 Event Retention Policy (`ObservabilityRetentionPolicy`)

Set retention days by event tier:

| tier | Default Retention | Description |
| --- | --- | --- |
| `tier_1` | `null` (Never auto-delete) | Key factual events, need long-term traceability |
| `tier_2` | `14` days | At-least-once events, can be cleaned after expiration |
| `tier_3` | `3` days | Best-effort events, short-cycle cleanup |

Event deletable conditions:

- The retention period for the belonging tier has expired
- **AND** associated task has reached terminal state (`done / failed / cancelled`) or task is empty

### 6.2 Message Retention Policy

- Default retention: `30` days
- Messages types in `preservedMessageTypes` whitelist never auto-delete (e.g., `compaction_summary`, `approval_decision`)
- Message deletable conditions:
  - Created time exceeds retention period
  - Message type not in preserved whitelist
  - **AND** associated session and task both reached terminal state

### 6.3 Protection Rules

- All messages of active sessions (non-terminal state) are protected, even if associated task is in terminal state.
- `CompactionRecord` never auto-deletes (compaction records are key lineage for context reconstruction).
- Retention policy supports `dry_run` and `enforced` modes: `dry_run` only generates reports without executing deletion.

## 7. Deletion and Exceptions

- PII deletion requests must have SLA.
- When legal hold is in effect, related objects can pause deletion, but must have audit traces.
- Backup deletion and primary database deletion must be distinguished.
- Retention policy execution results must generate `ObservabilityRetentionReport`, including cleanup statistics for each tier and message type.

## 8. Lineage Relationships

```mermaid
flowchart LR
    A["User Input"] --> B["Prompt Version"]
    B --> C["Model Version"]
    C --> D["Policy Decision"]
    D --> E["Execution Result"]
    E --> F["Feedback / Learning"]
    F --> G["Improvement / Strategy"]
    G --> H["Rollout / Release"]
    H --> I["Artifact / Audit"]
```

## 9. Export Requirements

Production systems should support exporting:

- Specified task audit package
- Specified tenant audit package
- Specified time window security events
- prompt/model/policy version correspondence
- Complete lineage of feedback -> learning -> improvement -> rollout

## 10. Closure Conclusion

Industrial-grade systems not only need to "log", but also prove:

- Who did it
- What version was used
- Why it was allowed
- Where data came from and where it went
