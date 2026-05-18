# Idempotency And Recovery Matrix Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-stage cycle:

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

- Any automatic retry must first pass idempotency judgment.
- Any recovery skip must have executed evidence.
- Non-idempotent `NodeAttempt` must not be automatically replayed by default.

## 3. Tool-Level Matrix

| Tool Category | Default Idempotent | Executed Check | Crash Recovery Strategy |
| --- | --- | --- | --- |
| Read-only query | Yes | Same input + no side effects | Can retry directly |
| File read | Yes | Path exists and not written | Can retry directly |
| File write (overwrite) | Implementation-dependent | Content checksum / write marker | Verify then skip or rewrite |
| File append | No | Append marker / transaction log | Defaults to human confirmation or explicit idempotency key |
| External API query | Usually yes | Request fingerprint | Can retry with limit |
| External API write | No | External resource id / idempotency key | Must not auto-retry by default |
| LLM inference | Yes | Response cache or execution lineage | Can retry, but cost needs recalculation |
| Artifact write | Policy-dependent | Artifact checksum / path | Can skip if exists and verified |

## 4. NodeRun / NodeAttempt Level Matrix

| Node Semantic Type | Idempotent | Recovery Strategy |
| --- | --- | --- |
| Pure inference / planning | High | Can rerun |
| Schema validation | High | Can rerun |
| Read-only tool node | High | Can rerun |
| Observe / Assess | High | Can rerun |
| Feedback / Learn | Medium | Allows reconstruction based on evidence, but must not consume objects that have reached terminal state |
| File generation node | Medium | Verify artifact then skip or rerun |
| Improve candidate evaluation | Low | Defaults to block auto-recovery, requires guardrail / lineage verification |
| Release rollout transition | Low | Defaults to block auto-recovery, prioritizes human confirmation or controlled rollback |
| External side-effect node | Low | Defaults to block auto-recovery |
| Approval waiting node | High | Rebuild waiting state |
| Streaming display node | Medium | Can replay staged results, not rebuild all chunks |

Rules:

- Canonical recovery objects are `NodeRun` and `NodeAttempt`; `step_id`, `workflow step`, `agent step` are allowed only as semantic labels in plan graph or display projections.
- Before automatic recovery, must first verify the most recent `NodeAttemptReceipt`, and must not determine skip eligibility based solely on "same step name".

## 5. Tool Metadata Requirements

Each tool should ultimately declare at minimum:

- `read_only`
- `idempotent`
- `side_effect_scope`
- `requires_confirmation`
- `recovery_strategy`

More detailed fields, consumers, and versioning rules follow the drilling document `tool_metadata_and_recovery_contract.md`.

`recovery_strategy` recommended enum:

- `retry_safe`
- `retry_with_check`
- `skip_if_verified`
- `manual_resume_required`

## 6. Phase 1a Minimum Requirements

Phase 1a does not pursue complete automatic judgment but must at least achieve:

- Distinguish read-only from side-effect tools
- Distinguish nodes safe for automatic retry from those not safe for automatic retry
- Retain executed evidence or explicitly block recovery for side-effect nodes

## 7. Related Documents

- `runtime_execution_contract.md`
- `tool_and_provider_execution_contract.md`
- `task_and_workflow_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 8. Closure Conclusion

The core of recovery capability is not "whether it can be run again", but knowing which `NodeRun / NodeAttempt` can be safely rerun and which must first confirm "whether it has already been done".

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-37: This document originally built the recovery matrix on `workflow step / step`. The root cause was that early linear workflow documents were directly applied to the recovery contract, and after `NodeRun / NodeAttempt / NodeAttemptReceipt` became runtime truth, the body still remained at the step perspective. Fix: The body now changes the canonical recovery object to `NodeRun / NodeAttempt`, and explicitly states that `step_id` is allowed only as semantic labels or display projections.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
