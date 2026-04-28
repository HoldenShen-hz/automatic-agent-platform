# Event Registry And Ops Threshold Contract

> **v4.3 Compatibility Note**: This file is preserved as the historical event registry and operations threshold documentation. v4.3 event tiering is based on [ADR-111](../adr/111-platform-fact-vs-oapeflir-view-events.md) and [event-envelope-contract.md](./event-envelope-contract.md); `platform.*` is truth fact, `oapeflir.view.*`/`oapeflir.rationale.*` are only projections.

> **OAPEFLIR Association**: This contract defines the OAPEFLIR 8-stage event registry, corresponding to ADR-016/ADR-079/ADR-080.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract, built upon `event_reliability_matrix_contract.md`, freezes the event registry, consumer relationships, and operations thresholds for the current phase.

Related documents:

- `event_bus_contract.md`
- `event_reliability_matrix_contract.md`
- `storage_schema_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`
- [ADR-079 Feedback Hub](../adr/079-feedback-hub-signals.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 2. Objectives

This document answers 3 questions:

- What stable event types currently exist.
- Who produces and who consumes each event type, and whether ack is required.
- When backlog or loss becomes an operations alert.

## 3. Registration Principles

- Events entering implementation must be registered here first.
- Tier 1 events must declare producer, consumer, ack strategy, and replay requirements.
- Tier 2/3 events, even if not mandatory for ack, must have clear usage scenarios to avoid event semantics drift.
- Each registered event automatically carries `payloadSchemaRef` (default `event://{domain}/{action}/v1`) and `compatibilityPolicy` (default `backward_compatible_additive`), for compile-time validation at the typed event bus layer.

## 4. Phase 1a / 1b Event Registry

| event_type | tier | producer | primary_consumers | ack_required | replay_required |
| --- | --- | --- | --- | --- | --- |
| `task.created` | `tier1` | gateway / scheduler | runtime, observability | Yes | Yes |
| `task.status_changed` | `tier1` | transition service | gateway, observability, recovery scan | Yes | Yes |
| `workflow.started` | `tier1` | workflow runtime | observability, recovery scan | Yes | Yes |
| `workflow.step_completed` | `tier1` | workflow runtime | orchestrator, recovery scan | Yes | Yes |
| `workflow.failed` | `tier1` | workflow runtime | supervisor, recovery scan | Yes | Yes |
| `approval.requested` | `tier1` | transition service / policy engine | gateway, approval inbox | Yes | Yes |
| `approval.resolved` | `tier1` | approval service | runtime, gateway | Yes | Yes |
| `execution.blocked` | `tier1` | runtime | supervisor, recovery scan | Yes | Yes |
| `execution.succeeded` | `tier1` | runtime | transition service, observability | Yes | Yes |
| `execution.failed` | `tier1` | runtime | supervisor, recovery scan | Yes | Yes |
| `cost.limit_reached` | `tier1` | budget guard / policy engine | runtime, gateway, observability | Yes | Yes |
| `oapeflir.observe.signals_collected` | `tier2` | observe hub | observability, inspect projection | No | Recommended |
| `oapeflir.assess.evaluation_completed` | `tier2` | assess hub | observability, inspect projection | No | Recommended |
| `oapeflir.plan.proposal_created` | `tier2` | plan hub | observability, inspect projection | No | Recommended |
| `feedback.signal_received` | `tier2` | feedback hub / gateway / explainability pipeline | learn hub, observability, inspect projection | No | Recommended |
| `learn.object_created` | `tier2` | learn hub | observability, inspect projection | No | Recommended |
| `learn.object_promoted` | `tier2` | learn hub | improvement pipeline, observability, inspect projection | No | Recommended |
| `improve.candidate_proposed` | `tier2` | improve hub | observability, inspect projection | No | Recommended |
| `improve.candidate_accepted` | `tier1` | improve hub / guardrail evaluator | release hub, observability, audit lineage | Yes | Yes |
| `release.rollout_started` | `tier1` | release hub | observability, audit lineage, inspect projection | Yes | Yes |
| `release.rollout_completed` | `tier1` | release hub | observability, audit lineage, inspect projection | Yes | Yes |
| `release.rollback_triggered` | `tier1` | release hub / supervisor | observability, audit lineage, inspect projection | Yes | Yes |
| `loop.iteration_completed` | `tier2` | oapeflir loop service | observability, inspect projection | No | Recommended |
| `gateway.message_received` | `tier2` | gateway adapter | runtime, observability | No | Recommended |
| `gateway.message_sent` | `tier2` | gateway adapter | observability | No | No |
| `tool.call_started` | `tier2` | tool executor | observability | No | No |
| `tool.call_completed` | `tier2` | tool executor | observability, cost tracker | No | Recommended |
| `supervisor.health_warning` | `tier2` | supervisor | observability, operator UI | No | Recommended |
| `stream.chunk_emitted` | `tier3` | gateway streaming bridge | UI / channel client | No | No |
| `heartbeat.sampled` | `tier3` | supervisor / runtime | observability | No | No |
| `dispatch:ticket_created` | `tier2` | execution dispatch service | inspect_projection | No | Recommended |
| `dispatch:ticket_claimed` | `tier2` | execution dispatch service | inspect_projection | No | Recommended |
| `dispatch:decision_recorded` | `tier2` | execution dispatch service | inspect_projection | No | Recommended |
| `dispatch:ticket_reconciled` | `tier2` | execution dispatch reconciliation service | inspect_projection | No | No |
| `dispatch:ticket_requeued` | `tier2` | execution dispatch reconciliation service | inspect_projection | No | No |
| `worker:claim_accepted` | `tier2` | execution worker handshake service | inspect_projection | No | Recommended |
| `worker:claim_rejected` | `tier2` | execution worker handshake service | inspect_projection | No | No |
| `worker:heartbeat_recorded` | `tier2` | execution worker handshake service | inspect_projection | No | No |
| `worker:writeback_recorded` | `tier2` | execution worker writeback service | inspect_projection | No | Recommended |
| `worker:writeback_rejected` | `tier2` | execution worker writeback service | inspect_projection | No | No |
| `worker:lease_released_after_writeback` | `tier2` | execution worker writeback service | inspect_projection | No | No |
| `takeover:session_opened` | `tier2` | human takeover service | inspect_projection | No | Recommended |
| `takeover:action_applied` | `tier2` | human takeover service | inspect_projection | No | Recommended |
| `recovery:repair_applied` | `tier2` | runtime repair service | inspect_projection | No | Recommended |
| `recovery:decision_recorded` | `tier2` | runtime recovery decision service | inspect_projection | No | Recommended |
| `recovery:dead_lettered` | `tier2` | runtime recovery decision service | inspect_projection | No | Recommended |
| `recovery:cancelled` | `tier2` | runtime recovery decision service | inspect_projection | No | No |
| `skill:execution_started` | `tier2` | skill execution service | inspect_projection | No | No |
| `skill:cache_miss` | `tier2` | skill execution service | inspect_projection | No | No |
| `skill:cache_hit` | `tier2` | skill execution service | inspect_projection | No | No |
| `skill:cache_stored` | `tier2` | skill execution service | inspect_projection | No | No |
| `skill:step_started` | `tier2` | skill execution service | inspect_projection | No | No |
| `skill:retry_scheduled` | `tier2` | skill execution service | inspect_projection | No | No |
| `skill:step_succeeded` | `tier2` | skill execution service | inspect_projection | No | No |
| `skill:step_failed` | `tier2` | skill execution service | inspect_projection | No | No |
| `skill:execution_completed` | `tier2` | skill execution service | inspect_projection | No | No |

## 5. Consumer Specifications

### 5.1 Tier 1 Consumers

Tier 1 standard consumers include at least:

- `runtime_recovery_scanner`
- `gateway_projection`
- `observability_sink`

Rules:

- The same Tier 1 event may be independently acknowledged by multiple consumers.
- One consumer's failure must not overwrite other consumers' acknowledgment results.
- When adding new Tier 1 consumers, startup inspection and ack thresholds must be synchronously evaluated.
- `gateway_projection`, `runtime_recovery_scanner`, `observability_sink` `consumer_id` must remain stable and must not drift due to process restarts.

### 5.2 Tier 2 Consumers

Current primary consumers for Tier 2 events is `inspect_projection`, used for maintaining inspect/diagnostics/timeline structured projections.

Grouped by domain:

- **OAPEFLIR events** (`oapeflir.*`, `feedback.*`, `learn.*`, `improve.*`, `release.*`, `loop.*`): Produced by each hub, projected to closed-loop timeline, feedback chain, and rollout diagnostics views.
- **Dispatch events** (`dispatch:*`): Produced by `execution_dispatch_service` or `execution_dispatch_reconciliation_service`, projected to dispatch decision trace and ticket status.
- **Worker events** (`worker:*`): Produced by `execution_worker_handshake_service` and `execution_worker_writeback_service`, projected to worker lease status and fencing audit.
- **Takeover events** (`takeover:*`): Produced by `human_takeover_service`, projected to human takeover audit chain.
- **Recovery events** (`recovery:*`): Produced by `runtime_repair_service` and `runtime_recovery_decision_service`, projected to recovery decision and dead-letter audit chain.
- **Skill events** (`skill:*`): Produced by `skill_execution_service`, projected to skill execution observability chain. Covers skill full lifecycle: start, cache miss/hit/store, step start/success/failure, retry scheduled, execution completed.

Rules:

- Tier 2 may skip persistent ack, but if undertaking key projection functionality, should explicitly declare degradation strategy in implementation.

### 5.3 Tier 3 Consumers

- No persistent ack
- Must not masquerade as recoverable fact source

## 6. Operations Thresholds

### 6.1 Backlog Alerts

| Metric | Threshold | Action |
| --- | --- | --- |
| Tier 1 unacked event count | `> 0` sustained `5m` | Alert |
| Single consumer Tier 1 backlog | `>= 20` | Alert and trigger recovery scan |
| Tier 2 backlog | `>= 100` sustained `10m` | Optional alert |
| Tier 3 loss | Not individually alerted | Only monitor trends |

### 6.2 Latency Thresholds

| Metric | Recommended Threshold | Action |
| --- | --- | --- |
| Tier 1 write-to-first-dispatch latency | `> 5s` | Alert |
| Tier 1 write-to-all-ack latency | `> 30s` | Alert |
| Tier 2 write-to-dispatch latency | `> 30s` | Optional alert |

### 6.3 Recovery Thresholds

| Scenario | Threshold | Action |
| --- | --- | --- |
| Tier 1 ack consecutive failures | `>= 3` | Mark `degraded` and enter recovery |
| Same event replay count | `>= 5` | Human intervention |
| Single consumer long-term inactivity | `> 10m` | Pause registration or degrade projection |

## 7. Write and Dispatch Order

```mermaid
flowchart TD
    A["Producer"] --> B["Insert Into events"]
    B --> C["Register event_consumer_acks"]
    C --> D["Commit"]
    D --> E["Dispatch To Consumers"]
    E --> F["Per-Consumer Ack / Retry"]
    F --> G["Ops Scan / Replay If Needed"]
```

Rules:

- Tier 1 must fully follow this chain.
- Tier 2 may skip `event_consumer_acks`, but if undertaking key projection in the future, should upgrade to Tier 1.
- Tier 3 must not masquerade as recoverable fact source.

## 8. Startup Inspection Linkage

Startup inspection checks at minimum:

- Whether Tier 1 events exceeding threshold are unacked
- Whether events with `event_type` produced but not registered in the registry
- Whether events with consumer status inconsistent with registry

## 9. Phase Boundaries

Phase 1a does:

- Tier 1/2/3 baseline registry
- Tier 1 per-consumer ack
- Basic backlog thresholds

Phase 1b does:

- More gateway/orchestration event types
- Finer consumer grouping and projection alerts

Currently excluded:

- External message queue partitioning strategy
- Cross-region event replication
- Enterprise event retention policy

## 10. Closure Conclusion

Whether the event system is reliable depends not only on "whether events are sent out", but on having a stable registry that specifies who should receive what, how long it should take to receive, and how the system reacts when not received.
