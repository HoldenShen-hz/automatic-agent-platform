# Diagnostics Snapshot And Repro Bundle Contract

## 1. Scope

This contract defines diagnostic snapshots at failure time, minimal reproduction bundles, and explanation patterns.

Related documents:

- `debug_inspect_health_backpressure_contract.md`
- `result_envelope_contract.md`
- `tool_output_sanitization_contract.md`

## 2. Objectives

Improve failure localization efficiency:

- Automatically generate diagnostic snapshots
- Export minimal reproduction bundles
- Support explanation patterns and decision chain views

## 3. `DiagnosticSnapshot`

Contains at minimum:

- Current status
- Recent events
- Recent tool calls
- Current context summary
- OAPEFLIR current phase and loop iteration summary
- File lock status
- Configuration version
- Provider status
- Basic system information (OS, version, architecture, runtime mode)
- Enabled extensions / plugins summary
- Prompt bundle / prompt template version summary
- Scheduling and planned task related summary (if system supports schedule / automation / scheduled workflow)

## 4. `MinimalReproBundle`

Contains at minimum:

- task input
- workflow state
- oapeflir timeline
- relevant messages
- tool usage
- feedback signals / learning objects / rollout refs (if relevant)
- sanitized artifacts
- config subset
- session / interaction export (if interaction layer exists)
- prompt bundle or minimal prompt overlay snapshot
- scheduled recipe / automation definition subset (if related to failure)

Supplementary rules:

- diagnostics / repro bundle should support export as a single compressed package or equivalent shareable artifact for easy support and troubleshooting.
- Before export, users must be explicitly reminded: bundle may contain session messages, logs, configuration, and other sensitive information.
- Diagnostics export should not default to containing raw secrets, unsanitized tokens, or sensitive fields from crash dumps.
- If the system supports issue / incident creation assistance, priority should be given to generating "report entry with pre-filled system information" rather than requiring users to manually collect environment information.
- If the system supports multiple prompt templates, scheduled tasks, or enabled extensions, the bundle should carry "actually effective versions/lists" as much as possible, rather than only exporting generic configuration.

## 5. `IncidentTimelineReport`

When a task fails or post-failure troubleshooting is needed, the system should be able to automatically generate an incident timeline report.

### 5.1 Minimum Fields

- `taskId`
- `traceSummary` (traceId / correlationId / spanIds)
- `window` (startedAt / endedAt / durationMs)
- `summary` (containing counts from various sources: event / dispatch / step_output / approval / artifact / log / remote_log / message / compaction)
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

When a task involves remote workers, the system should be able to generate a remote execution timeline sub-view:

- `taskId`, `traceSummary`
- `totalEntries`, `totalRemoteLogs`, `latestRemoteLogAt`
- `remoteWorkerIds`
- `entries`

## 5A. Diagnostic Warning Classification System

### 5A.1 Warning Categories

| category | Meaning |
| --- | --- |
| `health` | Health check anomaly (DB unwritable, provider failure, etc.) |
| `runtime` | Runtime anomaly (execution stalled, workflow failure, etc.) |
| `approval` | Approval anomaly (long pending, cascading rejections, etc.) |
| `takeover` | Human takeover related |
| `provider` | LLM provider degradation or unavailability |
| `dispatch` | Dispatch anomaly (worker unavailable, isolation not satisfied, etc.) |
| `remote_authority` | Remote worker permission violation or consistency anomaly |
| `other` | Uncategorized |

### 5A.2 Warning Severity

| severity | Meaning |
| --- | --- |
| `info` | For reference only, no immediate action required |
| `warning` | Needs attention, may require follow-up action |
| `critical` | Requires immediate response |

### 5A.3 Escalation Targets

| escalation | Meaning |
| --- | --- |
| `none` | No escalation needed |
| `task` | Escalate to task-level handling |
| `operator` | Escalate to operations personnel |

### 5A.4 `DiagnosticWarningSummary`

Aggregated warning summary contains at minimum:

- `totalEvents`
- `totalUniqueWarnings`
- `suppressedDuplicateCount` (count of suppressed deduplication iterations for same category)
- `highestSeverity`
- `escalationTargets`
- `entries` (each containing code / category / severity / escalation / count / suppressedCount)

## 6. `ExplanationRecord`

Used to answer:

- Why this division was selected
- Why HITL was escalated
- Why a command was rejected
- Why retry was triggered
- Why fallback provider was switched to
- Why an improvement candidate was accepted or rejected
- Why rollout was promoted or blocked

## 6. Closure Conclusion

Diagnostic snapshots, minimal reproduction bundles, and explanation patterns are key capabilities that transform "system has a problem and can only guess" into "system can explain its context itself".