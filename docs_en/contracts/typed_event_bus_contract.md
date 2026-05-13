# Typed Event Bus Contract

## 1. Scope

This contract defines the upper-layer requirements for a typed event bus, used to further freeze the current event registry and payload schema into strong type boundaries.

Related documents:

- `event_bus_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 2. Objectives

- Establish one-to-one correspondence between event type, payload schema, producer, and consumer.
- Reduce implementation drift caused by broad unions and manual payload handling.
- Provide a unified event definition source for code generation, linting, and replay tools.

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

- All OAPEFLIR hub events must have both a schema ref and a stable TypeScript payload type name.
- If `stage` exists, it must come from the canonical OAPEFLIR stage enumeration, not consumer-defined tags.

## 3A. OAPEFLIR Event Payload Types

Phase 1-4 loop-closed events must provide typed payloads, corresponding to ADR-079 and ADR-080:

### 3A.1 Observe Hub Events

`ObserveSignalsCollectedPayload`

- `task_id`
- `workflow_id?`
- `loop_iteration`
- `signal_count`
- `source_refs`
- `trace_id`

`UnifiedObservationCreatedPayload`

- `task_id`
- `observation_id`
- `situation_snapshot`
- `metrics`
- `trace_id`

### 3A.2 Assess Hub Events

`AssessmentCompletedPayload`

- `task_id`
- `assessment_id`
- `complexity`
- `risk_level`
- `confidence`
- `trace_id`

### 3A.3 Plan Hub Events

`PlanCreatedPayload`

- `task_id`
- `plan_id`
- `version`
- `strategy`
- `step_count`
- `trace_id`

`ReplanTriggeredPayload`

- `task_id`
- `plan_id`
- `old_version`
- `new_version`
- `trigger_type`
- `trace_id`

### 3A.4 Execute Hub Events

`ExecutionCompletedPayload`

- `task_id`
- `execution_id`
- `outcome`
- `output_refs`
- `trace_id`

### 3A.5 Feedback Hub Events (ADR-079)

`FeedbackCollectedPayload`

- `task_id`
- `feedback_id`
- `signal_count`
- `sources`
- `trace_id`

`FeedbackLearningSignalPayload`

- `signal_id`
- `task_id`
- `learning_signal_id`
- `type`
- `confidence`
- `source_signals`
- `trace_id`

### 3A.6 Learn Hub Events (ADR-080)

`LearningArtifactCreatedPayload`

- `learning_object_id`
- `kind`
- `confidence`
- `evidence_count`
- `trace_id`

`LearningObjectPromotedPayload`

- `learning_object_id`
- `from_status`
- `to_status`
- `namespace`
- `trust_level`
- `trace_id`

### 3A.7 Improve Hub Events (ADR-075)

`ImprovementCandidateCreatedPayload`

- `candidate_id`
- `learning_object_id`
- `priority`
- `target_scope`
- `trace_id`

`ImprovementPromotedPayload`

- `candidate_id`
- `from_level`
- `to_level`
- `triggered_by`
- `duration_minutes`
- `trace_id`

`ImprovementAutoRollbackPayload`

- `candidate_id`
- `from_level`
- `to_level`
- `trigger`
- `metrics_snapshot`
- `trace_id`

### 3A.8 Release Events

`ReleaseRolloutStartedPayload`

- `task_id`
- `rollout_id`
- `loop_iteration`
- `strategy_version`
- `level` (`L0` | `L1` | `L2` | `L3` | `L4` | `L5`)
- `triggered_by`

`ReleaseRolloutCompletedPayload`

- `rollout_id`
- `candidate_id`
- `final_level`
- `total_duration_minutes`
- `final_metrics`
- `trace_id`

Rules:

- Breaking changes to payload schema must be handled via new type name or explicit version upgrade.
- Tier 1 improvement / rollout events must not degrade to untyped `json` blobs.
- M2 event types not yet enabled may retain schema reservation, but must not be falsely published in production traffic.
- OAPEFLIR event types uniformly use `<stage>:<event>` format (e.g., `feedback:collected`, `learning:object_promoted`).

## 3B. Extension Plane Event Payload Types

If `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` baseline is enabled, corresponding extension-plane events must also provide typed payloads, covering at minimum:

`PluginIsolationEventPayload`

- `plugin_id`
- `spi_type`
- `phase`
- `reason_code`
- `lifecycle_state`
- `occurred_at`

`PluginInvocationEventPayload`

- `plugin_id`
- `spi_type`
- `phase`
- `invocation_id`
- `status`
- `occurred_at`
- `duration_ms?`
- `reason_code?`

Supplementary rules:

- `plugin:invocation_started` and `plugin:invocation_completed` must share a stable payload type, rather than each drifting into ad-hoc field sets.
- Extension-plane events may initially go through in-process typed bus, but must not therefore disguise as cross-process reliable delivery capability.
- If `domain:* / plugin:* / knowledge:*` events are consumed by feedback or projection, producer, consumer, and payload schema must be simultaneously traceable in the registry.

## 4. Compatibility Rules

- Backward-compatible fields may be added, not silently deleted or semantically changed.
- Breaking changes should introduce a new `event_type` or explicit version.
- Consumers should only subscribe to event types they explicitly declare support for.

## 5. Relationship with Existing EventBus

- `event_bus_contract.md` still defines bus semantics and acknowledgment boundaries.
- This contract defines the type-freezing layer on top of it.
- Transport upgrades must not break the typed event contract.

## 6. Closure Conclusion

Typed Event Bus is not another bus, but stronger schema and compatibility guarantees for the existing event system.