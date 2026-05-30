# Idempotency And Recovery Matrix Contract

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

This contract defines the idempotency matrix for tool calls and `NodeRun / NodeAttempt`, as well as handling strategies during crash recovery.

## 2. Core Principles

- Any automatic retry must first pass the idempotency check.
- Any recovery skip must have executed evidence.
- Non-idempotent `NodeAttempt` must not be automatically replayed by default.

## 3. Tool-Level Matrix

| Tool Category | Default Idempotent | Executed Check | Crash Recovery Strategy |
| --- | --- | --- | --- |
| Read-only queries | Yes | Same input + no side effects | Can retry directly |
| File read | Yes | Path exists and not written | Can retry directly |
| File write (overwrite) | Implementation-dependent | Content checksum / write marker | Verify then skip or rewrite |
| File append | No | Append marker / transaction log | Defaults to manual confirmation or explicit idempotency key |
| External API query | Usually yes | Request fingerprint | Can retry with limits |
| External API write | No | External resource id / idempotency key | Must not auto-retry by default |
| LLM inference | Yes | Response cache or execution lineage | Can retry but cost must be recalculated |
| Artifact write | Policy-dependent | Artifact checksum / path | Can skip if exists and verified |

## 4. NodeRun / NodeAttempt Level Matrix

| Node Semantic Type | Idempotency | Recovery Strategy |
| --- | --- | --- |
| Pure inference / planning | High | Can rerun |
| Schema validation | High | Can rerun |
| Read-only tool nodes | High | Can rerun |
| Observe / Assess | High | Can rerun |
| Feedback / Learn | Medium | Allows reconstruction based on evidence, but must not re-consume objects in terminal state |
| File generation nodes | Medium | Verify artifact then skip or rerun |
| Improve candidate evaluation | Low | Defaults to blocking auto-recovery, requires guardrail / lineage verification |
| Release rollout transition | Low | Defaults to blocking auto-recovery, prioritizes manual confirmation or controlled rollback |
| External side-effect nodes | Low | Defaults to blocking auto-recovery |
| Approval wait nodes | High | Rebuild wait state |
| Streaming display nodes | Medium | Can replay staged results, does not rebuild all chunks |

Rules:

- The canonical recovery object is `NodeRun` and `NodeAttempt`; `step_id`, `workflow step`, `agent step` are only allowed as semantic labels or display projections in the plan graph.
- Before automatic recovery, the most recent `NodeAttemptReceipt` must be verified first; it must not be determined as skippable solely based on "same step name".

## 5. Tool Metadata Requirements

Each tool should ultimately declare at least:

- `read_only`
- `idempotent`
- `side_effect_scope`
- `requires_confirmation`
- `recovery_strategy`

More detailed fields, consumers, and versioning rules are based on the detailed document `tool_metadata_and_recovery_contract.md`.

`recovery_strategy` recommended enumerations:

- `retry_safe`
- `retry_with_check`
- `skip_if_verified`
- `manual_resume_required`

## 6. Phase 1a Minimum Requirements

Phase 1a does not pursue complete automatic judgment, but at least must:

- Distinguish between read-only and side-effect tools
- Distinguish between nodes that can be safely auto-retried and those that cannot
- Retain executed evidence or explicitly block recovery for side-effect nodes

## 7. Related Documents

- `runtime_execution_contract.md`
- `tool_and_provider_execution_contract.md`
- `task_and_workflow_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 8. Conclusion

The core of recovery capability is not "whether it can run again," but knowing which `NodeRun / NodeAttempt` can safely run again and which must first confirm "whether it has already been done."


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` prevail.

- T-37: This document originally built the recovery matrix on `workflow step / step`. Root cause: Early linear workflow documentation was directly carried over to the recovery contract. After `NodeRun / NodeAttempt / NodeAttemptReceipt` became runtime truth, the main text still remained at the step perspective. Fix: The main text now changes the canonical recovery object to `NodeRun / NodeAttempt`, and clarifies that `step_id` is only allowed as semantic labels or display projections.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.