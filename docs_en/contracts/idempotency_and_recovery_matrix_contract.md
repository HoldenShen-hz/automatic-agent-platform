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

This contract defines idempotency matrix for tool calls and `NodeRun / NodeAttempt`, as well as handling strategies during crash recovery.

## 2. Core Principles

- Any automatic retry must first pass idempotency judgment.
- Any recovery skip must have executed evidence.
- Non-idempotent `NodeAttempt` must not be automatically replayed by default.

## 3. Tool-Level Matrix

| Tool Category | Default Idempotency | Executed Check | Crash Recovery Strategy |
| --- | --- | --- | --- |
| Read-only query | Yes | Same input + no side effects | Can retry directly |
| File read | Yes | Path exists and not written | Can retry directly |
| File write (overwrite) | Implementation-dependent | Content checksum / write marker | Verify then skip or rewrite |
| File append | No | Append marker / transaction log | Default to manual confirmation or explicit idempotency key |
| External API query | Usually | Request fingerprint | Can retry limitedly |
| External API write | No | External resource id / idempotency key | Must not auto-retry by default |
| LLM inference | Yes | Response cache or execution lineage | Can retry, but cost must be recalculated |
| Artifact write | Policy-dependent | Artifact checksum / path | If exists and verified, can skip |

## 4. NodeRun / NodeAttempt Level Matrix

| Node Semantic Type | Idempotency | Recovery Strategy |
| --- | --- | --- |
| Pure inference / planning | High | Can rerun |
| Schema validation | High | Can rerun |
| Read-only tool node | High | Can rerun |
| Observe / Assess | High | Can rerun |
| Feedback / Learn | Medium | Allows reconstruction based on evidence, but must not re-consume objects in terminal state |
| File generation node | Medium | Verify artifact then skip or rerun |
| Improve candidate evaluation | Low | Default to block automatic recovery, requires guardrail / lineage verification |
| Release rollout transition | Low | Default to block automatic recovery, prioritize manual confirmation or controlled rollback |
| External side-effect node | Low | Default to block automatic recovery |
| Approval wait node | High | Reconstruct wait state |
| Streaming display node | Medium | Can replay阶段性 results, not reconstruct all chunks |

Rules:

- Canonical recovery objects are `NodeRun` and `NodeAttempt`; `step_id`, `workflow step`, `agent step` are only allowed as semantic labels or display projections in plan graph.
- Before automatic recovery, must first verify latest `NodeAttemptReceipt`, must not determine skip solely based on "same step name".

## 5. Tool Metadata Requirements

Each tool should ultimately declare at minimum:

- `read_only`
- `idempotent`
- `side_effect_scope`
- `requires_confirmation`
- `recovery_strategy`

More detailed fields, consumers, and versioning rules are based on drill-down document `tool_metadata_and_recovery_contract.md`.

`recovery_strategy` suggested enum:

- `retry_safe`
- `retry_with_check`
- `skip_if_verified`
- `manual_resume_required`

## 6. Phase 1a Minimum Requirements

Phase 1a does not pursue complete automatic judgment, but must at minimum:

- Distinguish read-only from side-effect tools
- Distinguish nodes safely auto-retryable from not auto-retryable
- For side-effect nodes, retain executed evidence or explicitly block recovery

## 7. Related Documents

- `runtime_execution_contract.md`
- `tool_and_provider_execution_contract.md`
- `task_and_workflow_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 8. Conclusion

The core of recovery capability is not "whether it can run again", but knowing which `NodeRun / NodeAttempt` can safely run again, and which must first confirm "whether it has already been done".

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-37: This document originally built recovery matrix on `workflow step / step`. The root cause is early linear workflow documents were directly applied to recovery contract; after `NodeRun / NodeAttempt / NodeAttemptReceipt` became runtime truth, the main text still停留在 step perspective. Fix: The main text now changes canonical recovery objects to `NodeRun / NodeAttempt`, and explicitly states `step_id` is only allowed as semantic label or display projection.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only serve as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.