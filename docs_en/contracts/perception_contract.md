# Perception Contract

> **OAPEFLIR Relevance**: This contract defines the OAPEFLIR Observe Hub, corresponding to ADR-016 §3 and G6 solution.
> **Last Updated**: 2026-04-17

> **Compatibility Note**: The filename is preserved as `perception_contract.md` to maintain historical link stability; the current authoritative semantics are aligned to the OAPEFLIR `Observe` stage.

## 1. Scope

This contract defines the minimum specification for the `Observe` stage, including multi-source signal collection, context snapshot construction, and risk/domain hint organization.

Currently, "perception" is no longer viewed as an independent business plane; it is a historical naming compatibility shell whose actual semantics are aligned with `ObserveHub`.

## 2. Key Objects

- `ObserveSource`
- `ObserveSignal`
- `TaskSituation`
- `SystemSituation`
- `TaskSituationBuilder`
- `SystemSituationBuilder`
- `ObservationAggregator`
- `ObserveSchedule`

## 3. ObserveSource Minimum Fields

- `source_id`
- `type`, value set: `rss | web | github | api | custom`
- `name`
- `enabled`
- `schedule`
- `filters`
- `priority`
- `trust_tier?`

## 4. ObserveSignal Minimum Fields

- `signal_id`
- `source_id`
- `kind`
- `summary`
- `raw_ref`
- `relevance_score`
- `risk_score?`
- `domain_hints?`
- `captured_at`

## 5. TaskSituation Minimum Fields

- `task_id`
- `context_snapshot`
- `risk_signals`
- `domain_hints`
- `source_refs`
- `generated_at`

## 5.1 SystemSituation Minimum Fields

- `health_status`: `ok | degraded | overloaded | unhealthy`
- `provider_health`: Map<providerId, { available, latencyP99 }>
- `resource_utilization`: { memoryMB, cpuPercent, activeProcesses }
- `event_bus_backlog`: Number of pending events
- `generated_at`

## 5.2 ObservationAggregator

`ObservationAggregator` is the sole exit point for the Observe stage, aggregating `TaskSituation` + `SystemSituation` into `UnifiedObservation`:

```typescript
interface UnifiedObservation {
  taskSituation: TaskSituation;
  systemSituation: SystemSituation;
  aggregatedAt: string;
}
```

## 6. Behavioral Constraints

- Observe does not modify the main task chain by default, only produces signals and `TaskSituation`.
- Observe stage output must be traceable to source ref or signal ref before entering `Assess / Plan`.
- Duplicate information must support deduplication and TTL.
- Observe analysis costs must be traceable and budget-controlled.

## 8. Supplementary Rules

- Information source capability matrix must record at minimum: pull method, frequency, trustworthiness, cost level, and triggerable action scope.
- `TaskSituationBuilder` must produce at minimum: `context_snapshot`, `risk_signals`, `domain_hints`.
- `SystemSituationBuilder` must produce at minimum: `health_status`, `provider_health`, `resource_utilization`, `event_bus_backlog`.
- Active task creation or action triggering must go through HQ/system policy by default; Observe must not directly issue these on its own.