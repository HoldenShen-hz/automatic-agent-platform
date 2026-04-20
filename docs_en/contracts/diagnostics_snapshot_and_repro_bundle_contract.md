# Diagnostics Snapshot And Repro Bundle Contract

## 1. Scope

This contract defines diagnostic snapshots on failure, minimal reproduction bundles, and explanation modes.

Related documents:

- `debug_inspect_health_backpressure_contract.md`
- `result_envelope_contract.md`
- `tool_output_sanitization_contract.md`

## 2. Goals

Improve failure location efficiency:

- Automatically generate diagnostic snapshots
- Export minimal reproduction packages
- Support explanation mode and decision chain views

## 3. `DiagnosticSnapshot`

At minimum includes:

- Current state
- Recent events
- Recent tool calls
- Current context summary
- OAPEFLIR current stage and loop iteration summary
- File lock status
- Configuration version
- Provider status
- Basic system information (OS, version, architecture, execution mode)
- Enabled extensions / plugins summary
- Prompt bundle / prompt template version summary
- Scheduling and planned task related summaries (if system supports schedule / automation / scheduled workflow)

## 4. `MinimalReproBundle`

At minimum includes:

- task input
- workflow state
- oapeflir timeline
- relevant messages
- tool usage
- feedback signals / learning objects / rollout refs (if related)
- sanitized artifacts
- config subset
- session / interaction export (if interaction layer exists)
- prompt bundle or minimum prompt overlay snapshot
- scheduled recipe / automation definition subset (if related to failure)

Supplementary rules:

- Diagnostics / repro bundle should support exporting as a single compressed package or equivalent shareable artifact for support and troubleshooting.
- Before exporting, must clearly remind users: bundle may contain session messages, logs, configuration, and other sensitive information.
- Diagnostics export must not default to containing secret plaintext, unsanitized tokens, or sensitive fields in crash dumps.
- If the system supports issue / incident creation assistance, should prioritize generating "a report entry with pre-filled system information" rather than requiring users to manually collect environment information.
- If the system supports multiple prompt templates, scheduled tasks, or enabled extensions, bundle should as much as possible carry "the actual effective version/list" rather than only exporting generic configuration.

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

Each timeline entry at minimum includes:

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

When a task involves remote workers, should be able to generate a remote execution timeline sub-view:

- `taskId`, `traceSummary`
- `totalEntries`, `totalRemoteLogs`, `latestRemoteLogAt`
- `remoteWorkerIds`
- `entries`

## 5A. Diagnostic Warning Classification System

### 5A.1 Warning Categories

| category | Meaning |
| --- | --- |
| `health` | Health check abnormality (DB unwritable, provider failure, etc.) |
| `runtime` | Runtime abnormality (execution stalled, workflow failed, etc.) |
| `approval` | Approval abnormality (long-time pending, cascading rejections, etc.) |
| `takeover` | Human takeover related |
| `provider` | LLM provider degradation or unavailable |
| `dispatch` | Dispatch abnormality (worker unavailable, isolation not satisfied, etc.) |
| `remote_authority` | Remote worker permission violation or consistency abnormality |
| `other` | Uncategorized |

### 5A.2 Warning Severity

| severity | Meaning |
| --- | --- |
| `info` | For awareness only, no immediate action needed |
| `warning` | Needs attention, may need follow-up action |
| `critical` | Needs immediate response |

### 5A.3 Escalation Targets

| escalation | Meaning |
| --- | --- |
| `none` | No escalation needed |
| `task` | Escalate to task-level handling |
| `operator` | Escalate to operations personnel |

### 5A.4 `DiagnosticWarningSummary`

Aggregated warning summary at minimum includes:

- `totalEvents`
- `totalUniqueWarnings`
- `suppressedDuplicateCount` (count of similar deduplication suppressed)
- `highestSeverity`
- `escalationTargets`
- `entries` (each containing code / category / severity / escalation / count / suppressedCount)

## 6. `ExplanationRecord`

Used to answer:

- Why this division was chosen
- Why HITL was escalated
- Why the command was rejected
- Why retry was triggered
- Why fallback provider was switched to
- Why improvement candidate was accepted or rejected
- Why rollout was advanced or blocked

## 6. Closure Conclusion

Diagnostic snapshots, minimal reproduction bundles, and explanation modes are the key capabilities that transform "when the system has problems you can only guess" into "the system can explain its context itself."
