# Typed Event Bus Contract

## 1. Scope

This contract defines upper-layer requirements for the typed event bus, further freezing current event registration and payload schema into strong-type boundaries.

Related Documents:

- `event_bus_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 2. Goals

- Let event type, payload schema, producer, and consumer form one-to-one correspondence.
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

- All OAPEFLIR hub events must simultaneously have schema ref and stable TypeScript payload type name.
- If `stage` exists, must come from canonical OAPEFLIR stage enum, not consumer-defined tags.

## 3A. OAPEFLIR Event Payload Types

Phase 1-4 closed-loop events must provide typed payloads, corresponding to ADR-079 and ADR-080:

### 3A.1 Observe Hub Events

`ObserveSignalsCollectedPayload`

- `harness_run_id`
- `plan_graph_id?`
- `loop_iteration`
- `signal_count`
- `source_refs`
- `trace_id`
- `derived_from_event_id?`

`UnifiedObservationCreatedPayload`

- `harness_run_id`
- `observation_id`
- `situation_snapshot`
- `metrics`
- `trace_id`
- `derived_from_event_id?`

### 3A.2 Assess Hub Events

`AssessmentCompletedPayload`

- `harness_run_id`
- `assessment_id`
- `complexity`
- `risk_level`
- `confidence`
- `trace_id`
- `derived_from_event_id?`

### 3A.3 Plan Hub Events

`PlanCreatedPayload`

- `harness_run_id`
- `plan_graph_id`
- `graph_version`
- `strategy`
- `node_count`
- `trace_id`
- `derived_from_event_id?`

`ReplanTriggeredPayload`

- `harness_run_id`
- `plan_graph_id`
- `previous_graph_version`
- `next_graph_version`
- `trigger_type`
- `trace_id`
- `derived_from_event_id`

### 3A.4 Execute Hub Events

`ExecutionCompletedPayload`

- `harness_run_id`
- `node_run_id`
- `node_attempt_id?`
- `receipt_ref`
- `status`
- `output_refs`
- `trace_id`
- `derived_from_event_id`

### 3A.5 Feedback Hub Events (ADR-079)

`FeedbackCollectedPayload`

- `harness_run_id`
- `feedback_id`
- `signal_count`
- `sources`
- `trace_id`
- `derived_from_event_id?`

`FeedbackLearningSignalPayload`

- `signal_id`
- `harness_run_id`
- `learning_signal_id`
- `type`
- `confidence`
- `source_signals`
- `trace_id`
- `derived_from_event_id?`

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

- `harness_run_id`
- `rollout_id`
- `loop_iteration`
- `strategy_version`
- `level` (`L0` | `L1` | `L2` | `L3` | `L4` | `L5`)
- `triggered_by`
- `derived_from_event_id?`

`ReleaseRolloutCompletedPayload`

- `rollout_id`
- `candidate_id`
- `final_level`
- `total_duration_minutes`
- `final_metrics`
- `trace_id`

Rules:

- Breaking changes to payload schema must be handled through new type name or explicit version upgrade.
- Tier 1 improvement/rollout events must not degrade to untyped `json` blob.
- Disabled M2 event types may retain schema reserved slots, must not be fictitiously published in production traffic.
- OAPEFLIR event types uniformly use `<stage>:<event>` format (e.g., `feedback:collected`, `learning:object_promoted`).
- Typed payloads derived from preceding facts or events must explicitly carry `derived_from_event_id` to avoid losing causal source in Plan/Execute/Feedback chain.

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

Supplementary Rules:

- `plugin:invocation_started` and `plugin:invocation_completed` must share stable payload type, rather than each drifting into ad-hoc field sets.
- Extension-plane events may first go to in-process typed bus, but must not therefore disguise as cross-process reliable delivery capability.
- If `domain:* / plugin:* / knowledge:*` events are consumed by feedback or projection, producer, consumer, and payload schema must be simultaneously traceable in registry.

## 4. Compatibility Rules

- Backward-compatible fields may be added, must not be silently deleted or have semantics changed.
- Breaking changes should open new `event_type` or use explicit version.
- Consumers should only subscribe to event types they declare support for.

## 5. Relationship with Existing EventBus

- `event_bus_contract.md` still defines bus semantics and acknowledgment boundaries.
- This contract defines the type-freezing layer on top of it.
- Transport upgrades must not break typed event contract.

## 6. Closing Conclusion

Typed Event Bus is not another bus, but adds stronger schema and compatibility guarantees to the existing event system.