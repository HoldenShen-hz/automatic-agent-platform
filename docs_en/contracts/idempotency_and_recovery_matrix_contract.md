# Idempotency And Recovery Matrix Contract

---

## OAPEFLIR Related

This contract participates in the following stages of the OAPEFLIR 8-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution evaluation and risk assessment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines idempotency matrix for tool calls and workflow steps, and handling strategies during crash recovery.

## 2. Core Principles

- Any automatic retry must first pass idempotency judgment.
- Any recovery skip must have executed evidence.
- Non-idempotent steps default to no auto-replay.

## 3. Tool-Level Matrix

| Tool Category | Default Idempotency | Executed Check | Crash Recovery Strategy |
| --- | --- | --- | --- |
| Read-only query | Yes | Same input + no side effects | Can retry directly |
| File read | Yes | Path exists and not written | Can retry directly |
| File write (overwrite) | Implementation-dependent | Content checksum / write marker | Verify then skip or rewrite |
| File append | No | Append marker / transaction log | Default to human confirmation or explicit idempotency key |
| External API query | Usually yes | Request fingerprint | Can retry with limit |
| External API write | No | External resource id / idempotency key | Default to no auto-retry |
| LLM inference | Yes | Response cache or execution lineage | Can retry, but cost must be recalculated |
| Artifact write | Policy-dependent | Artifact checksum / path | If exists and verified, can skip |

## 4. Workflow Step-Level Matrix

| Step Type | Idempotency | Recovery Strategy |
| --- | --- | --- |
| Pure reasoning / planning | High | Can rerun |
| Schema validation | High | Can rerun |
| Read-only tool step | High | Can rerun |
| Observe / Assess | High | Can rerun |
| Feedback / Learn | Medium | Allow reconstruction based on evidence, but must not re-consume terminal objects |
| File generation step | Medium | Verify artifact then skip or rerun |
| Improve candidate evaluation | Low | Default to block auto-recovery; requires guardrail / lineage verification |
| Release rollout transition | Low | Default to block auto-recovery; prioritize human confirmation or controlled rollback |
| External side effect step | Low | Default to block auto-recovery |
| Approval wait step | High | Reconstruct wait state |
| Streaming display step | Medium | Can replay staged results; do not reconstruct all chunks |

## 5. Tool Metadata Requirements

Each tool should eventually declare at minimum:

- `read_only`
- `idempotent`
- `side_effect_scope`
- `requires_confirmation`
- `recovery_strategy`

More detailed fields, consumers, and versioning rules are governed by `tool_metadata_and_recovery_contract.md`.

`recovery_strategy` suggested enumeration:

- `retry_safe`
- `retry_with_check`
- `skip_if_verified`
- `manual_resume_required`

## 6. Phase 1a Minimum Requirements

Phase 1a does not pursue complete automatic judgment, but at minimum must:

- Distinguish read-only from side-effect tools
- Distinguish safe auto-retry from non-auto-retry steps
- Preserve executed evidence or explicitly block recovery for side-effect steps

## 7. Related Documents

- `runtime_execution_contract.md`
- `tool_and_provider_execution_contract.md`
- `task_and_workflow_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 8. Closure Conclusion

The core of recovery capability is not "whether it can be run again", but knowing which steps can be safely rerun and which steps must first confirm "whether it has already been done".