# Typed Event Bus Contract

## 1. Scope

This contract defines the upper-layer requirements of the typed event bus, used to further freeze the current event registration and payload schema into a strongly-typed boundary.

Related documents:

- `event_bus_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 2. Goals

- Let event type, payload schema, producer, and consumer form a one-to-one correspondence.
- Reduce the implementation drift brought by broad unions and handcrafted payloads.
- Provide a unified event definition source for code generation, lint, and replay tools.

## 3. Type Model

Each event definition must at least contain:

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
- If `stage` exists, it must come from the canonical OAPEFLIR stage enum, rather than consumer-defined labels.

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

- Destructive changes to the payload schema must be handled through a new type name or explicit version upgrade.
- Tier 1 improvement / rollout events must not degrade into untyped `json` blobs.
- M2 event types that are not enabled can retain schema reserved slots, but must not be forged for release in production traffic.
- OAPEFLIR event types uniformly use the `<stage>:<event>` format (e.g., `feedback:collected`, `learning:object_promoted`).
- Typed payloads derived from preceding facts or events must explicitly carry `derived_from_event_id`, to avoid losing the causal source in the Plan / Execute / Feedback chain.

## 3B. Extension Plane Event Payload Types

If the `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` baseline is enabled, the corresponding extension-plane events must also provide typed payloads, at least covering:

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

Additional rules:

- `plugin:invocation_started` and `plugin:invocation_completed` must share a stable payload type, rather than each drifting into an ad-hoc field set.
- Extension-plane events are allowed to first go through the in-process typed bus, but must not be disguised as cross-process reliable delivery capability.
- If `domain:* / plugin:* / knowledge:*` events are consumed by feedback or projection, the producer, consumer, and payload schema must be simultaneously traceable in the registry.

## 4. Compatibility Rules

- Backward-compatible fields can be added; they cannot be silently removed or have their semantics changed.
- Destructive changes should open a new `event_type` or use an explicit version.
- Consumers should only subscribe to the event types they declare to support.

## 5. Relationship to the Existing EventBus

- `event_bus_contract.md` still defines the bus semantics and acknowledgment boundary.
- This contract defines the type freezing layer on top of it.
- When the transport is upgraded, the typed event contract must not be broken.

## 6. Closure Conclusion

The Typed Event Bus is not another bus, but a stronger schema and compatibility guarantee added to the existing event system.
