# Typed Event Bus Contract

## 1. Scope

This contract defines upper-layer requirements for the typed event bus, further freezing the current event registry and payload schema into strong type boundaries.

Related documents:

- `event_bus_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 2. Goals

- Make event type, payload schema, producer, and consumer form one-to-one correspondence.
- Reduce implementation drift caused by broad unions and manual payloads.
- Provide unified event definition source for code generation, lint, and replay tools.

## 3. Type Model

Each event definition at minimum contains:

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
- If `stage` exists, it must come from canonical OAPEFLIR stage enumeration, not consumer-defined tags.

## 3A. OAPEFLIR Event Payload Types

Phase 1-4 closed-loop events must provide typed payload, covering at minimum the following interfaces:

`ObserveSignalsCollectedPayload`

- `task_id`
- `workflow_id?`
- `loop_iteration`
- `signal_count`
- `source_refs`
- `trace_id`

`FeedbackSignalReceivedPayload`

- `task_id`
- `signal_id`
- `loop_iteration`
- `kind`
- `sentiment`
- `source`
- `evidence_ref?`

`ImproveCandidateAcceptedPayload`

- `task_id`
- `candidate_id`
- `loop_iteration`
- `strategy_version`
- `accepted_by`
- `guardrail_result_ref`

`ReleaseRolloutStartedPayload`

- `task_id`
- `rollout_id`
- `loop_iteration`
- `strategy_version`
- `level` (`off | suggest | shadow`)
- `triggered_by`

Rules:

- Breaking changes to payload schema must be handled through new type name or explicit version upgrade.
- Tier 1 improvement / rollout events must not degrade to untyped `json` blob.
- Unenabled M2 event types can retain schema reserved positions but must not be fraudulently published in production traffic.

## 3B. Extension Plane Event Payload Types

If `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` baseline is enabled, corresponding extension-plane events must also provide typed payload, covering at minimum:

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

- `plugin:invocation_started` and `plugin:invocation_completed` must share stable payload type rather than each drifting into ad-hoc field sets.
- Extension-plane events are allowed to first go through in-process typed bus but must not therefore impersonate cross-process reliable delivery capability.
- If `domain:* / plugin:* / knowledge:*` events are consumed by feedback or projection, producer, consumer, and payload schema must be simultaneously traceable in registry.

## 4. Compatibility Rules

- Backward-compatible fields can be added, not silently deleted or semantically changed.
- Breaking changes should open new `event_type` or explicit version.
- Consumers should only subscribe to event types they explicitly declare support for.

## 5. Relationship with Existing EventBus

- `event_bus_contract.md` still defines bus semantics and acknowledgment boundaries.
- This contract defines the type freezing layer on top of it.
- Transport upgrades must not break typed event contract.

## 6. Closure Conclusion

Typed Event Bus is not another bus but adds stronger schema and compatibility guarantees to the existing event system.
