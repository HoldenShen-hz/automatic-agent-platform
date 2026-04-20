# Diagnostics Snapshot And Repro Bundle Contract

## 1. Scope

This contract defines diagnostic snapshots at failure, minimal reproduction bundles, and explanation patterns.

Related documents:

- `debug_inspect_health_backpressure_contract.md`
- `result_envelope_contract.md`
- `tool_output_sanitization_contract.md`

## 2. Goals

Improve failure location efficiency:

- Automatically generate diagnostic snapshots.
- Export minimal reproduction bundles.
- Support explanation patterns and decision chain views.

## 3. `DiagnosticSnapshot`

At minimum contains:

- Current state
- Recent events
- Recent tool calls
- Current context summary
- OAPEFLIR current stage and loop iteration summary
- File lock status
- Configuration version
- Provider status
- Basic system info (OS, version, architecture, execution mode)
- Enabled extensions / plugins summary
- Prompt bundle / prompt template version summary
- Scheduling and planned task-related summary (if system supports schedule / automation / scheduled workflow)

## 4. `MinimalReproBundle`

At minimum contains:

- Task input
- Workflow state
- OAPEFLIR timeline
- Relevant messages
- Tool usage
- Feedback signals / learning objects / rollout refs (if relevant)
- Sanitized artifacts
- Config subset
- Session / interaction export (if interaction layer exists)
- Prompt bundle or minimal prompt overlay snapshot
- Scheduled recipe / automation definition subset (if related to failure)

Supplementary rules:

- Diagnostics / repro bundles should support exporting as a single compressed archive or equivalent shareable artifact for support and troubleshooting.
- Before exporting, users must be explicitly reminded that bundles may contain session messages, logs, configuration, and other sensitive information.
- Diagnostics exports must not include secret plaintext, unsanitized tokens, or sensitive fields in crash dumps by default.
- If the system supports issue / incident creation assistance, it should prioritize generating "report入口 pre-filled with system information" rather than requiring users to manually collect environment information.
- If the system supports multiple prompt templates, scheduled tasks, or enabled extensions, bundles should carry "actual effective version/manifest" as much as possible, rather than just exporting generic configuration.

## 5. `IncidentTimelineReport`

When a task fails or post-mortem troubleshooting is needed, the system should be able to automatically generate an incident timeline report.

### 5.1 Minimum Fields

- `taskId`
- `traceSummary` (traceId / correlationId / spanIds)
- `window` (startedAt / endedAt / durationMs)
- `summary` (including counts from various sources: event / dispatch / step_output / approval / artifact / log / remote_log / message / compaction)
- `highestSeverity`
- `warnings` (structured warning summary)
- `candidateRootCauses` (automatically inferred possible root causes)
- `entries` (incident entries sorted by time)

### 5.2 IncidentTimelineEntry

Each timeline entry contains at minimum:

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Entry ID |
| `source` | `string` | Source: `event` / `dispatch` / `step_output` / `approval` / `artifact` / `log` / `remote_log` / `message` / `compaction` |
| `occurredAt` | `timestamp` | Occurrence time |
| `title` | `string` | Entry title |
| `summary` | `string` | Entry summary |
| `severity` | `string` | `info` / `warning` / `critical` |
| `traceId?` | `string` | Associated trace |
| `spanId?` | `string` | Associated span |
| `data` | `json` | Entry payload |

### 5.3 RemoteTimelineReport

When a task involves remote workers, the system should be able to generate a remote execution timeline subview:

- `taskId`, `traceSummary`
- `totalEntries`, `totalRemoteLogs`, `latestRemoteLogAt`
- `remoteWorkerIds`
- `entries`

## 5A. Diagnostic Warning Classification System

### 5A.1 Warning Categories

| Category | Meaning |
| --- | --- |
| `health` | Health check abnormality (DB not writable, provider failure, etc.) |
| `runtime` | Runtime exception (execution stalled, workflow failed, etc.) |
| `approval` | Approval abnormality (long-time pending, cascading rejection, etc.) |
| `takeover` | Human takeover related |
| `provider` | LLM provider degraded or unavailable |
| `dispatch` | Dispatch abnormality (worker unavailable, isolation not satisfied, etc.) |
| `remote_authority` | Remote worker permission violation or consistency abnormality |
| `other` | Uncategorized |

### 5A.2 Warning Severity

| Severity | Meaning |
| --- | --- |
| `info` | For awareness only; no immediate action required |
| `warning` | Needs attention; may require follow-up action |
| `critical` | Requires immediate response |

### 5A.3 Escalation Targets

| Escalation | Meaning |
| --- | --- |
| `none` | No escalation needed |
| `task` | Escalate to task-level handling |
| `operator` | Escalate to operations personnel |

### 5A.4 `DiagnosticWarningSummary`

Aggregated warning summary contains at minimum:

- `totalEvents`
- `totalUniqueWarnings`
- `suppressedDuplicateCount` (count of similar deduplication suppressions)
- `highestSeverity`
- `escalationTargets`
- `entries` (each containing code / category / severity / escalation / count / suppressedCount)

## 6. `ExplanationRecord`

Used to answer:

- Why this division was chosen
- Why HITL was escalated
- Why a command was rejected
- Why a retry was triggered
- Why a fallback provider was switched to
- Why an improvement candidate was accepted or rejected
- Why a rollout was promoted or blocked

## 7. Conclusion

Diagnostic snapshots, minimal reproduction bundles, and explanation patterns are the key capabilities that transform "when the system has a problem you can only guess" into "the system can explain its context itself."
