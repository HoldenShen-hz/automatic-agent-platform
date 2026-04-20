# Result Envelope Contract

## 1. Scope

This contract defines unified result envelope across tools, steps, divisions, and task layers.

Related documents:

- `task_and_workflow_contract.md`
- `tool_and_provider_execution_contract.md`
- `artifact_store_contract.md`
- `app_error_contract.md`

## 2. Goals

Through unified result envelope, reduce lateral proliferation of the following result objects:

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
| `structured_data` | `json?` | Structured main data |
| `human_summary` | `string?` | Human-readable summary |
| `warnings` | `string[]?` | Warnings |
| `artifacts` | `ArtifactRef[]?` | Outputs |
| `metrics` | `json?` | Token / duration / cost metrics |
| `error` | `AppError?` | Error object |
| `provenance` | `json?` | Source information |

## 4. Rules

- Any domain result can be projected to `ResultEnvelope`.
- `error` and `status=error` must remain consistent.
- `partial` must explicitly state missing or degraded points and must not impersonate success.
- `artifacts` only holds references and does not embed large content in envelope.

## 4A. Builder Semantics

### 4A.1 Task Result Builder

`buildTaskResultEnvelope(task, stepOutputs, artifacts)` projects task state to result envelope:

- `done` → `success`, `failed | cancelled` → `error`, others → `partial`
- If task has no output, no step output, no artifact, returns `null` (does not generate empty envelope).
- `human_summary` extraction priority: `outputJson.summary` → `outputJson.humanSummary` → `outputJson.result` → last step summary → task title.
- `error.message` extraction priority: `outputJson.error.message` (deep path) → `outputJson.summary` → `task.title`.
- `metrics` aggregates all steps' `tokenCost` and `durationMs`.

### 4A.2 Step Result Builder

`buildStepResultEnvelope(stepOutput, artifacts)` projects step output to result envelope:

- `succeeded` → `success`, `failed` → `error`, others → `partial`
- `warnings` source: append warnings, validation failures, validation warnings when step status is `partial_success`.

### 4A.3 Artifact Merging

- Artifact references (`ArtifactRef`) and artifact records (`ArtifactRecord`) can be merged by ID.
- Deduplication strategy: prioritize deduplication by `id`; when id is missing, use `uri + createdAt` composite key.
- During merge, ref attributes (e.g., stepId, lineage) and record attributes (e.g., sizeBytes, checksum) do shallow merge.

## 5. Closure Conclusion

Unified result envelope allows display, audit, API, and recovery logic to all face the same result shell rather than being dragged by the quantity of specific result types.
