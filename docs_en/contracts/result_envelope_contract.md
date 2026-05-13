# Result Envelope Contract

> **OAPEFLIR Relevance**: This contract defines the result envelope for OAPEFLIR Execute Hub, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines unified result envelope across tools, steps, divisions, and task layers.

Related documents:
- [ADR-016 OAPEFLIR Eight-Stage Model](../adr/016-oapeflir-loop-model.md)

Related documents:

- `task_and_workflow_contract.md`
- `tool_and_provider_execution_contract.md`
- `artifact_store_contract.md`
- `app_error_contract.md`

## 2. Goals

Reduce lateral proliferation of result objects through unified result envelope:

- `ToolResult`
- `StepOutput`
- `DivisionResult`
- `TaskFailureReport`
- `PreconditionFailure`

## 3. `ResultEnvelope`

| Field | Type | Description |
|-------|------|-------------|
| `result_id` | `string` | Result ID |
| `status` | `success \| partial \| error` | Result status |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Closed-loop stage |
| `loop_iteration` | `integer?` | Loop iteration number |
| `structured_data` | `json?` | Structured main data |
| `human_summary` | `string?` | Human-readable summary |
| `warnings` | `string[]?` | Warnings |
| `artifacts` | `ArtifactRef[]?` | Artifacts |
| `feedback_signals` | `string[]?` | Related feedback signal references |
| `learning_objects` | `string[]?` | Related learning object references |
| `ref_ids` | `string[]?` | Other typed ref collections |
| `metrics` | `json?` | Token / duration / cost metrics |
| `error` | `AppError?` | Error object |
| `provenance` | `json?` | Provenance information |

## 4. Rules

- Any domain result can project to `ResultEnvelope`.
- `error` and `status=error` must be consistent.
- `partial` must explicitly state missing or degraded points, not disguise as success.
- `artifacts` only holds references, do not embed large content into envelope.

## 4A. Builder Semantics

### 4A.1 Task Result Builder

`buildTaskResultEnvelope(task, stepOutputs, artifacts)` projects task status to result envelope:

- `done` -> `success`, `failed | cancelled` -> `error`, others -> `partial`
- If task has no output, no step output, no artifact, return `null` (do not generate empty envelope).
- `human_summary` extraction priority: `outputJson.summary` -> `outputJson.humanSummary` -> `outputJson.result` -> last step's summary -> task title.
- `error.message` extraction priority: `outputJson.error.message` (deep path) -> `outputJson.summary` -> `task.title`.
- `metrics` aggregates all step's `tokenCost` and `durationMs`.
- If task / workflow has recorded `current_stage` or `loop_iteration`, result envelope must project the same named field.

### 4A.2 Step Result Builder

`buildStepResultEnvelope(stepOutput, artifacts)` projects step output to result envelope:

- `succeeded` -> `success`, `failed` -> `error`, others -> `partial`
- `warnings` source: append warnings, validation failures, validation warnings when step status is `partial_success`.
- If step output has declared `stage`, result envelope must pass through that `stage`.

### 4A.4 Feedback Result Builder

`buildFeedbackResultEnvelope(feedbackSignals, artifacts)` at minimum should:

- Use `stage=feedback`
- Expose `feedback_signals`
- Aggregate positive/negative, correction, quality metrics into `structured_data / metrics`
- If no consumable feedback, should return explicit empty set instead of omitting fields

### 4A.5 Rollout Result Builder

`buildRolloutResultEnvelope(rolloutRecord, artifacts)` at minimum should:

- Use `stage=release`
- Expose rollout / strategy / approval references in `ref_ids`
- Project current rollout level, status, metrics to `structured_data`
- Current phase1-4 authoritative scope only allows `off / suggest / shadow`

### 4A.3 Artifact Merging

- Artifact references (`ArtifactRef`) and artifact records (`ArtifactRecord`) can be merged by ID.
- Deduplication strategy: prioritize deduplication by `id`; if id is missing, deduplicate by `uri + createdAt` composite key.
- During merge, ref attributes (like stepId, lineage) and record attributes (like sizeBytes, checksum) do shallow merge.

## 5. Closure Conclusion

Unified result envelope allows display, audit, API, and recovery logic to face the same result shell, rather than being dragged by the number of concrete result types.