# Result Envelope Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR Execute Hub 的结果封装，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. Scope

This contract defines unified result envelope across tools, steps, divisions, and task layers.

相关文档：
- [ADR-016 OAPEFLIR 八阶段模型](../adr/016-oapeflir-loop-model.md)

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
| --- | --- | --- |
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

### 4A.1 HarnessRun Result Builder

`buildHarnessRunResultEnvelope(harnessRun, nodeRunResults, planGraphBundle, artifacts)` projects HarnessRun status to result envelope:

- `completed` -> `success`, `failed` -> `error`, `aborted` -> `error`, others -> `partial`
- If HarnessRun has no node runs, no output, no artifact, return `null` (do not generate empty envelope).
- `human_summary` extraction priority: `nodeRunResults[].summary` -> `planGraphBundle.metadata.summary` -> HarnessRun goal -> harnessRunId.
- `error.message` extraction priority: last failed NodeRun error message -> HarnessRun failure reason -> harnessRunId.
- `metrics` aggregates all NodeRun durationMs, tokenCost, and computeCost.
- Result envelope must project `harness_run_id`, `node_run_ids[]`, and `plan_graph_bundle_id` when present.
- If HarnessRun has recorded `current_stage` or `loop_iteration`, result envelope must project the same named field.

### 4A.2 NodeRun Result Builder

`buildNodeRunResultEnvelope(nodeRun, nodeAttemptReceipts, artifacts)` projects NodeRun output to result envelope:

- `completed` -> `success`, `failed` -> `error`, others -> `partial`
- `warnings` source: append warnings, validation failures, validation warnings when NodeRun status is `partial_success`.
- If NodeRun output has declared `stage`, result envelope must pass through that `stage`.
- Must include `node_run_id` and `harness_run_id` as correlation fields.

### 4A.3 Feedback Result Builder

`buildFeedbackResultEnvelope(feedbackSignals, artifacts)` at minimum should:

- Use `stage=feedback`
- Expose `feedback_signals`
- Aggregate positive/negative, correction, quality metrics into `structured_data / metrics`
- If no consumable feedback, should return explicit empty set instead of omitting fields

### 4A.5 Release Result Builder

`buildReleaseResultEnvelope(releaseRecord, artifacts)` at minimum should:

- Use `stage=release`
- Expose release / strategy / approval references in `ref_ids`
- Project current release level, status, metrics to `structured_data`
- Current phase1-4 authoritative scope only allows `off / suggest / shadow`

### 4A.3 Artifact Merging

- Artifact references (`ArtifactRef`) and artifact records (`ArtifactRecord`) can be merged by ID.
- Deduplication strategy: prioritize deduplication by `id`; if id is missing, deduplicate by `uri + createdAt` composite key.
- During merge, ref attributes (like stepId, lineage) and record attributes (like sizeBytes, checksum) do shallow merge.

## v4.3 Contract Remediation

- T-37: 早期版本引用 `buildTaskResultEnvelope` 作为主构建入口。v4.3 canonical 构建器为 `buildHarnessRunResultEnvelope` / `buildNodeRunResultEnvelope`，投影到 `HarnessRun -> NodeRun` 链而非 `Task -> Execution` 旧模型。

## 5. 收口结论

Unified result envelope allows display, audit, API, and recovery logic to face the same result shell, rather than being dragged by the number of concrete result types.
