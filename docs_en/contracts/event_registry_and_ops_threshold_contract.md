# Event Registry And Ops Threshold Contract

## 1. Scope

This contract, on top of `event_reliability_matrix_contract.md`, continues to freeze the event registry, consumer relationships, and ops thresholds for the current phase.

Related documents:

- `event_bus_contract.md`
- `event_reliability_matrix_contract.md`
- `storage_schema_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`

## 2. Goals

This document answers 3 questions:

- What stable event types currently exist.
- Who produces and who consumes each type of event, and whether ack is needed.
- When backlog or loss becomes an ops alert.

## 3. Registration Principles

- Events entering implementation must first be registered here.
- Tier 1 events must declare producer, consumer, ack strategy, and replay requirements.
- Tier 2 / 3 even without mandatory ack must clarify usage scenarios to avoid event semantics drift.
- Each registered event automatically carries `payloadSchemaRef` (default `event://{domain}/{action}/v1`) and `compatibilityPolicy` (default `backward_compatible_additive`) for compile-time validation by typed event bus layer.

## 4. Phase 1a / 1b Event Registry

| event_type | tier | producer | primary_consumers | ack_required | replay_required |
| --- | --- | --- | --- | --- | --- |
| `task.created` | `tier1` | gateway / scheduler | runtime, observability | yes | yes |
| `task.status_changed` | `tier1` | transition service | gateway, observability, recovery scan | yes | yes |
| `workflow.started` | `tier1` | workflow runtime | observability, recovery scan | yes | yes |
| `workflow.step_completed` | `tier1` | workflow runtime | orchestrator, recovery scan | yes | yes |
| `workflow.failed` | `tier1` | workflow runtime | supervisor, recovery scan | yes | yes |
| `approval.requested` | `tier1` | transition service / policy engine | gateway, approval inbox | yes | yes |
| `approval.resolved` | `tier1` | approval service | runtime, gateway | yes | yes |
| `execution.blocked` | `tier1` | runtime | supervisor, recovery scan | yes | yes |
| `execution.succeeded` | `tier1` | runtime | transition service, observability | yes | yes |
| `execution.failed` | `tier1` | runtime | supervisor, recovery scan | yes | yes |
| `cost.limit_reached` | `tier1` | budget guard / policy engine | runtime, gateway, observability | yes | yes |
| `gateway.message_received` | `tier2` | gateway adapter | runtime, observability | no | recommended |
| `gateway.message_sent` | `tier2` | gateway adapter | observability | no | no |
| `tool.call_started` | `tier2` | tool executor | observability | no | no |
| `tool.call_completed` | `tier2` | tool executor | observability, cost tracker | no | recommended |
| `supervisor.health_warning` | `tier2` | supervisor | observability, operator UI | no | recommended |
| `stream.chunk_emitted` | `tier3` | gateway streaming bridge | UI / channel client | no | no |
| `heartbeat.sampled` | `tier3` | supervisor / runtime | observability | no | no |
| `dispatch:ticket_created` | `tier2` | execution dispatch service | inspect_projection | no | recommended |
| `dispatch:ticket_claimed` | `tier2` | execution dispatch service | inspect_projection | no | recommended |
| `dispatch:decision_recorded` | `tier2` | execution dispatch service | inspect_projection | no | recommended |
| `dispatch:ticket_reconciled` | `tier2` | execution dispatch reconciliation service | inspect_projection | no | no |
| `dispatch:ticket_requeued` | `tier2` | execution dispatch reconciliation service | inspect_projection | no | no |
| `worker:claim_accepted` | `tier2` | execution worker handshake service | inspect_projection | no | recommended |
| `worker:claim_rejected` | `tier2` | execution worker handshake service | inspect_projection | no | no |
| `worker:heartbeat_recorded` | `tier2` | execution worker handshake service | inspect_projection | no | no |
| `worker:writeback_recorded` | `tier2` | execution worker writeback service | inspect_projection | no | recommended |
| `worker:writeback_rejected` | `tier2` | execution worker writeback service | inspect_projection | no | no |
| `worker:lease_released_after_writeback` | `tier2` | execution worker writeback service | inspect_projection | no | no |
| `takeover:session_opened` | `tier2` | human takeover service | inspect_projection | no | recommended |
| `takeover:action_applied` | `tier2` | human takeover service | inspect_projection | no | recommended |
| `recovery:repair_applied` | `tier2` | runtime repair service | inspect_projection | no | recommended |
| `recovery:decision_recorded` | `tier2` | runtime recovery decision service | inspect_projection | no | recommended |
| `recovery:dead_lettered` | `tier2` | runtime recovery decision service | inspect_projection | no | recommended |
| `recovery:cancelled` | `tier2` | runtime recovery decision service | inspect_projection | no | no |
| `skill:execution_started` | `tier2` | skill execution service | inspect_projection | no | no |
| `skill:cache_miss` | `tier2` | skill execution service | inspect_projection | no | no |
| `skill:cache_hit` | `tier2` | skill execution service | inspect_projection | no | no |
| `skill:cache_stored` | `tier2` | skill execution service | inspect_projection | no | no |
| `skill:step_started` | `tier2` | skill execution service | inspect_projection | no | no |
| `skill:retry_scheduled` | `tier2` | skill execution service | inspect_projection | no | no |
| `skill:step_succeeded` | `tier2` | skill execution service | inspect_projection | no | no |
| `skill:step_failed` | `tier2` | skill execution service | inspect_projection | no | no |
| `skill:execution_completed` | `tier2` | skill execution service | inspect_projection | no | no |

## 5. Consumer Specifications

### 5.1 Tier 1 Consumers

Tier 1 standard consumers at minimum include:

- `runtime_recovery_scanner`
- `gateway_projection`
- `observability_sink`

Rules:

- The same Tier 1 event can be independently acknowledged by multiple consumers.
- One consumer's failure must not overwrite other consumers' acknowledgment results.
- When adding new Tier 1 consumer, startup scan and ack threshold must be synchronously evaluated.
- `gateway_projection`, `runtime_recovery_scanner`, `observability_sink` `consumer_id` must remain stable and must not drift due to process restart.

### 5.2 Tier 2 Consumers

Current Tier 2 events' primary consumer is `inspect_projection`, used for maintaining structured projections of inspect / diagnostics / timeline.

Grouped by domain:

- **dispatch events** (`dispatch:*`): Produced by `execution_dispatch_service` or `execution_dispatch_reconciliation_service`, projected to dispatch decision trace and ticket status.
- **worker events** (`worker:*`): Produced by `execution_worker_handshake_service` and `execution_worker_writeback_service`, projected to worker lease state and fencing audit.
- **takeover events** (`takeover:*`): Produced by `human_takeover_service`, projected to human takeover audit chain.
- **recovery events** (`recovery:*`): Produced by `runtime_repair_service` and `runtime_recovery_decision_service`, projected to recovery decision and dead-letter audit chain.
- **skill events** (`skill:*`): Produced by `skill_execution_service`, projected to skill execution observability chain. Covers skill complete lifecycle: start, cache hit/miss/store, step start/success/fail, retry schedule, execution complete.

Rules:

- Tier 2 does not require persistent ack, but if undertaking key projection function, should explicitly declare degradation strategy in implementation.

### 5.3 Tier 3 Consumers

- No persistent ack
- Must not impersonate recoverable fact source

## 6. Ops Thresholds

### 6.1 Backlog Alerts

| Metric | Threshold | Action |
| --- | --- | --- |
| Tier 1 unacked events | `> 0` persisting `5m` | Alert |
| Single consumer Tier 1 backlog | `>= 20` | Alert and trigger recovery scan |
| Tier 2 backlog | `>= 100` persisting `10m` | Optional alert |
| Tier 3 loss | Not individually alerted | Only monitor trends |

### 6.2 Latency Thresholds

| Metric | Recommended Threshold | Action |
| --- | --- | --- |
| Tier 1 write to first dispatch latency | `> 5s` | Alert |
| Tier 1 write to all acks latency | `> 30s` | Alert |
| Tier 2 write to dispatch latency | `> 30s` | Optional alert |

### 6.3 Recovery Thresholds

| Scenario | Threshold | Action |
| --- | --- | --- |
| Tier 1 ack consecutive failures | `>= 3` times | Mark `degraded` and enter recovery |
| Same event replay count | `>= 5` times | Human intervention |
| Single consumer long-term inactive | `> 10m` | Pause registration or degrade projection |

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

- Tier 1 must fully go through this chain.
- Tier 2 can skip `event_consumer_acks`, but if undertaking key projection in future, should upgrade to Tier 1.
- Tier 3 must not impersonate recoverable fact source.

## 8. Startup Scan Linkage

Startup scan checks at minimum:

- Whether Tier 1 events exceeding threshold are unacked
- Whether any `event_type` produced but not registered in registry
- Whether any consumer state inconsistent with registry events

## 9. Phase Boundaries

Phase 1a does:

- Tier 1 / 2 / 3 baseline registry
- Tier 1 per-consumer ack
- Basic backlog threshold

Phase 1b does:

- More gateway / orchestration event types
- More granular consumer grouping and projection alerts

Currently does not do:

- External message queue partitioning strategy
- Cross-region event replication
- Enterprise event retention policy

## 10. Closure Conclusion

Whether an event system is reliable depends not only on "whether events are sent" but on whether there is a stable registry clarifying who should receive, how long they should receive, and how the system reacts when they do not receive.
