# Diagnostics Snapshot And Repro Bundle Contract

## 1. Scope

This contract defines diagnostic snapshots on failure, minimal reproduction bundles, and explanation modes.

Related Documents:

- `debug_inspect_health_backpressure_contract.md`
- `result_envelope_contract.md`
- `tool_output_sanitization_contract.md`

## 2. Goals

Improve failure location efficiency:

- Automatically generate diagnostic snapshots
- Export minimal reproduction bundles
- Support explanation modes and decision chain views

## 3. DiagnosticSnapshot

Contains at least:

- Current state
- Recent events
- Recent tool calls
- Current context summary
- OAPEFLIR current phase and loop iteration summary
- File lock status
- Configuration version
- Provider status
- Basic system information (OS, version, architecture, execution mode)
- Enabled extensions / plugins summary
- Prompt bundle / prompt template version summary
- Scheduling and planned task related summary (if system supports schedule / automation / scheduled workflow)

## 4. MinimalReproBundle

Contains at least:

- Task input
- Workflow state
- Oapeflir timeline
- Relevant messages
- Tool usage
- Feedback signals / learning objects / rollout refs (if related)
- Sanitized artifacts
- Config subset
- Session / interaction export (if interaction layer exists)
- Prompt bundle or minimal prompt overlay snapshot
- Scheduled recipe / automation definition subset (if related to failure)

Supplementary rules:

- Diagnostics / repro bundle should support exporting as a single compressed package or equivalent shareable artifact for support and troubleshooting.
- Must clearly remind users before export: bundle may contain session messages, logs, configuration, and other sensitive information.
- Diagnostics export should not default to including secret plaintext, unsanitized tokens, or sensitive fields in crash dumps.
- If system supports issue / incident creation assistance, should prioritize generating "pre-filled system information report entry", rather than requiring users to manually collect environment information.
- If system supports multiple prompt templates, planned tasks, or enabled extensions, bundle should carry "actually effective version/list" as much as possible, rather than only exporting general configuration.

## 5. IncidentTimelineReport

When tasks fail or post-mortem troubleshooting is needed, system should be able to automatically generate incident timeline report.

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

Each timeline entry contains at least:

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

When tasks involve remote workers, should be able to generate remote execution timeline sub-view:

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
| `approval` | Approval abnormality (long-time pending, cascade rejection, etc.) |
| `takeover` | Human takeover related |
| `provider` | LLM provider degradation or unavailability |
| `dispatch` | Dispatch abnormality (worker unavailable, isolation not met, etc.) |
| `remote_authority` | Remote worker permission violation or consistency abnormality |
| `other` | Unclassified |

### 5A.2 Warning Severity

| severity | Meaning |
| --- | --- |
| `info` | For reference only, no immediate action required |
| `warning` | Needs attention, may need follow-up action |
| `critical` | Requires immediate response |

### 5A.3 Escalation Targets

| escalation | Meaning |
| --- | --- |
| `none` | No escalation |
| `task` | Escalate to task-level handling |
| `operator` | Escalate to operations personnel |

### 5A.4 DiagnosticWarningSummary

Aggregated warning summary contains at least:

- `totalEvents`
- `totalUniqueWarnings`
- `suppressedDuplicateCount` (count of similar dedup suppressed)
- `highestSeverity`
- `escalationTargets`
- `entries` (each containing code / category / severity / escalation / count / suppressedCount)

## 6. ExplanationRecord

Used to answer:

- Why this division was selected
- Why HITL was escalated
- Why command was rejected
- Why retry was triggered
- Why fallback provider was switched
- Why improvement candidate was accepted or rejected
- Why rollout was advanced or blocked

## 6. Closure Conclusion

Diagnostic snapshots, minimal reproduction bundles, and explanation modes are key capabilities to change "when system has problems can only guess" to "system can explain its context by itself".
