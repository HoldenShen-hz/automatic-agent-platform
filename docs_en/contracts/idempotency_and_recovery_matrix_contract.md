# Idempotency And Recovery Matrix Contract

## 1. Scope

This contract defines idempotency matrix for tool calls and workflow steps, as well as handling strategies during crash recovery.

## 2. Core Principles

- Any automatic retry must first go through idempotency judgment.
- Any recovery skip must have executed evidence.
- Non-idempotent steps must not be automatically replayed by default.

## 3. Tool-Level Matrix

| Tool Category | Default Idempotency | Executed Check | Crash Recovery Strategy |
| --- | --- | --- | --- |
| Read-only query | Yes | Same input + no side effects | Can retry directly |
| File read | Yes | Path exists and not written | Can retry directly |
| File write (overwrite) | Depends on implementation | Content checksum / write marker | Verify then skip or rewrite |
| File append | No | Append marker / transaction log | Default to manual confirmation or explicit idempotency key |
| External API query | Usually yes | Request fingerprint | Can retry with limit |
| External API write | No | External resource id / idempotency key | Must not auto-retry by default |
| LLM inference | Yes | Response cache or execution lineage | Can retry but cost must be recalculated |
| Artifact write | Depends on policy | Artifact checksum / path | Can skip if exists and passes verification |

## 4. Workflow Step-Level Matrix

| Step Type | Idempotency | Recovery Strategy |
| --- | --- | --- |
| Pure reasoning / planning | High | Can re-run |
| Schema validation | High | Can re-run |
| Read-only tool step | High | Can re-run |
| Observe / Assess | High | Can re-run |
| Feedback / Learn | Medium | Allow reconstruction based on evidence but must not re-consume objects that have reached terminal state |
| File generation step | Medium | Verify artifact then skip or re-run |
| Improve candidate evaluation | Low | Default to blocking automatic recovery; requires guardrail / lineage verification |
| Release rollout transition | Low | Default to blocking automatic recovery; prioritize manual confirmation or controlled rollback |
| External side effect step | Low | Default to blocking automatic recovery |
| Approval wait step | High | Rebuild wait state |
| Streaming display step | Medium | Can replay staged results; not rebuild all chunks |

## 5. Tool Metadata Requirements

Each tool should ultimately at minimum declare:

- `read_only`
- `idempotent`
- `side_effect_scope`
- `requires_confirmation`
- `recovery_strategy`

More detailed fields, consumers, and versioning rules follow the drill-down document `tool_metadata_and_recovery_contract.md`.

`recovery_strategy` suggested enumeration:

- `retry_safe`
- `retry_with_check`
- `skip_if_verified`
- `manual_resume_required`

## 6. Phase 1a Minimum Requirements

Phase 1a does not pursue complete automatic judgment but at minimum must:

- Distinguish read-only from side-effect tools
- Distinguish safely auto-retryable from non-auto-retryable steps
- Retain executed evidence for side-effect steps or explicitly block recovery

## 7. Related Documents

- `runtime_execution_contract.md`
- `tool_and_provider_execution_contract.md`
- `task_and_workflow_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 8. Closure Conclusion

The core of recovery capability is not "whether it can run again" but knowing which steps can safely run again and which steps must first confirm "whether it has already been done."
