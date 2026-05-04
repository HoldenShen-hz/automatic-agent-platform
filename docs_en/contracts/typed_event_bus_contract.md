# Typed Event Bus Contract

## 1. Scope

This contract defines the upper-layer requirements for the typed event bus, used to further freeze the current event registry and payload schema to strong type boundaries.

Related documents:

- `event_bus_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 2. Objectives

- Make event type, payload schema, producer, and consumer form one-to-one correspondence.
- Reduce implementation drift caused by broad unions and manual payload.
- Provide unified event definition source for code generation, lint, and replay tools.

## 3. Type Model

Each event definition must contain at minimum:

- `event_type`
- `tier`
- `payload_schema_ref`
- `payload_type_name`
- `stage?`
- `producer`
- `consumers`
- `compatibility_policy`

Requirements:

- All OAPEFLIR hub events must have both schema ref and stable TypeScript payload type name.
- If `stage` exists, must come from canonical OAPEFLIR stage enumeration, not consumer-defined tags.
- **v4.3 Mandatory Rule**: OAPEFLIR event payloads must use `harnessRunId`, `nodeRunId`, `planGraphId` as runtime chain anchors; use of deprecated `task_id`, `workflow_id`, `execution_id` as primary key fields is prohibited.

## 3A. OAPEFLIR Event Payload Types

Phase 1-4 loop events must provide typed payloads, corresponding to ADR-079 and ADR-080. **All payloads must use canonical runtime chain identifiers**: `harnessRunId` / `nodeRunId` / `planGraphId`.

### 3A.1 Observe Hub Events

`ObserveSignalsCollectedPayload`

- `harnessRunId` — canonical runtime chain anchor
- `nodeRunId?` — optional node identifier
- `planGraphId?` — optional plan graph identifier
- `loopIteration` — loop iteration number
- `signalCount` — signal count
- `sourceRefs` — source reference list
- `traceId` — trace ID

`UnifiedObservationCreatedPayload`

- `harnessRunId` — canonical runtime chain anchor
- `observationId` — observation record ID
- `situationSnapshot` — situation snapshot
- `metrics` — metrics data
- `traceId` — trace ID
- `nodeRunId?` — optional node identifier
- `planGraphId?` — optional plan graph identifier

### 3A.2 Assess Hub Events

`AssessmentCompletedPayload`

- `harnessRunId` — canonical runtime chain anchor
- `assessmentId` — assessment ID
- `complexity` — complexity level
- `riskLevel` — risk level
- `confidence` — confidence
- `traceId` — trace ID
- `nodeRunId?` — optional node identifier

### 3A.3 Plan Hub Events

`PlanCreatedPayload` — **graph structure replaces linear steps**

- `harnessRunId` — canonical runtime chain anchor
- `planGraphId` — **canonical** PlanGraph identifier (formerly plan_id)
- `planVersion` — plan version (formerly version)
- `strategy` — planning strategy
- `nodeCount` — graph node count (replaces `step_count`)
- `edgeCount` — graph edge count
- `traceId` — trace ID
- `loopIteration?` — loop iteration

**Rule**: `step_count` is deprecated. PlanCreatedPayload must use `nodeCount` + `edgeCount` to represent graph structure, reflecting PlanGraph's graph-based semantics.

`ReplanTriggeredPayload`

- `harnessRunId` — canonical runtime chain anchor
- `planGraphId` — plan graph ID (formerly plan_id)
- `baseGraphVersion` — base graph version (formerly old_version)
- `newGraphVersion` — new graph version (formerly new_version)
- `derivedFromEventId` — source event ID that triggered the replan (for audit chain)
- `triggerType` — trigger type
- `traceId` — trace ID
- `nodeRunId?` — optional node identifier

### 3A.4 Execute Hub Events

`ExecutionCompletedPayload` — **NodeAttemptReceipt model replaces old execution model**

- `harnessRunId` — canonical runtime chain anchor
- `nodeRunId` — NodeRun identifier (formerly execution_id)
- `attemptId` — attempt ID
- `receiptId` — NodeAttemptReceipt ID
- `attemptStatus` — attempt status (replaces outcome)
- `outputRefs?` — output reference list
- `traceId` — trace ID
- `planGraphId?` — optional plan graph identifier

**Rule**: Old `execution_id` / `outcome` fields are deprecated. ExecutionCompletedPayload must use the NodeAttemptReceipt model with `nodeRunId` + `attemptId` + `attemptStatus`, consistent with `node-run-attempt-receipt-contract.md` §5.

### 3A.5 Feedback Hub Events (ADR-079)

`FeedbackCollectedPayload`

- `harnessRunId` — canonical runtime chain anchor
- `nodeRunId?` — optional node identifier
- `feedbackId` — feedback ID
- `signalCount` — signal count
- `sources` — source list
- `traceId` — trace ID
- `planGraphId?` — optional plan graph identifier

`FeedbackLearningSignalPayload`

- `signalId` — signal ID (canonical)
- `harnessRunId` — canonical runtime chain anchor
- `learningSignalId` — learning signal ID
- `type` — signal type
- `confidence` — confidence
- `sourceSignals` — source signal list
- `traceId` — trace ID
- `nodeRunId?` — optional node identifier

### 3A.6 Learn Hub Events (ADR-080)

`LearningArtifactCreatedPayload`

- `learningObjectId` — learning object ID
- `kind` — object type
- `confidence` — confidence
- `evidenceCount` — evidence count
- `traceId` — trace ID
- `harnessRunId?` — optional runtime chain anchor
- `planGraphId?` — optional plan graph identifier

`LearningObjectPromotedPayload`

- `learningObjectId` — learning object ID
- `fromStatus` — original status
- `toStatus` — new status
- `namespace` — namespace
- `trustLevel` — trust level
- `traceId` — trace ID
- `harnessRunId?` — optional runtime chain anchor

### 3A.7 Improve Hub Events (ADR-075)

`ImprovementCandidateCreatedPayload`

- `candidateId` — candidate ID
- `learningObjectId` — learning object ID
- `priority` — priority
- `targetScope` — target scope
- `traceId` — trace ID
- `harnessRunId?` — optional runtime chain anchor

`ImprovementPromotedPayload`

- `candidateId` — candidate ID
- `fromLevel` — original level
- `toLevel` — new level
- `triggeredBy` — triggered by
- `durationMinutes` — duration in minutes
- `traceId` — trace ID
- `harnessRunId?` — optional runtime chain anchor

`ImprovementAutoRollbackPayload`

- `candidateId` — candidate ID
- `fromLevel` — original level
- `toLevel` — new level
- `trigger` — trigger reason
- `metricsSnapshot` — metrics snapshot
- `traceId` — trace ID
- `harnessRunId?` — optional runtime chain anchor

### 3A.8 Release Hub Events

`ReleaseRolloutStartedPayload`

- `harnessRunId` — canonical runtime chain anchor
- `rolloutId` — rollout ID
- `loopIteration` — loop iteration
- `strategyVersion` — strategy version
- `level` (`L0` | `L1` | `L2` | `L3` | `L4` | `L5`) — release level
- `triggeredBy` — triggered by
- `tier?` — SLA tier (if any)

`ReleaseRolloutCompletedPayload`

- `rolloutId` — rollout ID
- `candidateId` — candidate ID
- `finalLevel` — final level
- `totalDurationMinutes` — total duration in minutes
- `finalMetrics` — final metrics
- `traceId` — trace ID
- `harnessRunId?` — optional runtime chain anchor

Rules:

- Breaking changes to payload schema must be handled through new type name or explicit version upgrade.
- Tier 1 improvement / rollout events must not degrade to untyped `json` blob.
- M2 event types not yet enabled can retain schema reservation, but must not be falsely published in production traffic.
- OAPEFLIR event types uniformly use `<stage>:<event>` format (e.g., `feedback:collected`, `learning:object_promoted`).

## 3B. Extension Plane Event Payload Types

If `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` baseline is enabled, corresponding extension-plane events must also provide typed payloads, covering at least:

`PluginIsolationEventPayload`

- `pluginId`
- `spiType`
- `phase`
- `reasonCode`
- `lifecycleState`
- `occurredAt`

`PluginInvocationEventPayload`

- `pluginId`
- `spiType`
- `phase`
- `invocationId`
- `status`
- `occurredAt`
- `durationMs?`
- `reasonCode?`

Supplementary rules:

- `plugin:invocation_started` and `plugin:invocation_completed` must share stable payload type, rather than each drifting into ad-hoc field sets.
- Extension-plane events are allowed to first go through in-process typed bus, but must not therefore disguise as cross-process reliable delivery capability.
- If `domain:* / plugin:* / knowledge:*` events are consumed by feedback or projection, producer, consumer, and payload schema must be simultaneously traceable in registry.

## 4. Compatibility Rules

- Backward-compatible fields can be added, not silently deleted or semantic-changed.
- Breaking changes should open new `event_type` or explicit version.
- Consumers should only subscribe to event types they explicitly declare support for.

## 5. Relationship with Existing EventBus

- `event_bus_contract.md` still defines bus semantics and acknowledgment boundaries.
- This contract defines the type-freezing layer on top of it.
- Transport upgrades must not break typed event contract.

## 5.5 v4.3 Canonical Runtime Chain Identifiers

**Mandatory Requirement**: All OAPEFLIR event payloads must use `harnessRunId` as the top-level anchor. Use of `task_id`, `workflow_id`, `execution_id` as primary keys is prohibited.

| Deprecated Field | Canonical Replacement |
| --- | --- |
| `task_id` | `harnessRunId` |
| `workflow_id` | `planGraphId` |
| `execution_id` | `nodeRunId` + `attemptId` |
| `step_count` | `nodeCount` + `edgeCount` (PlanGraph graph structure) |

## 6. Closure Conclusion

Typed Event Bus is not another bus, but stronger schema and compatibility guarantees for the existing event system.

## v4.3 Contract Remediation

- R2-67 / T-67: OAPEFLIR event payloads originally used `task_id`/`workflow_id`/`execution_id`. The root cause was early event design did not connect to v4.3 runtime chain identifier system. Fix: Section 3A now uses `harnessRunId`/`nodeRunId`/`planGraphId` as authoritative anchors throughout; deprecated fields are retained only as backward-compatibility notes.
- R2-68 / T-68: `PlanCreatedPayload` used `step_count` implying linear steps, conflicting with §5 PlanGraph graph structure. Fix: This document now uses `nodeCount` + `edgeCount` instead of `step_count`, explicitly expressing graph structure.
- R2-69 / T-69: `ExecutionCompletedPayload` defined old execution model (execution_id/outcome), conflicting with §5 NodeAttemptReceipt (receiptId/nodeRunId/attemptId/status). Fix: This document now uses NodeAttemptReceipt model fields.