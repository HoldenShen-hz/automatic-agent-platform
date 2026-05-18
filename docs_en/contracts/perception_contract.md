# Perception Contract

> **OAPEFLIR Related**: This contract defines OAPEFLIR Observe Hub, corresponding to ADR-016 §3 and G6 solution.
> **Updated**: 2026-04-17

> Compatibility note: The filename is kept as `perception_contract.md` to maintain historical link stability; the current authoritative semantics have been closed to OAPEFLIR's `Observe` stage.

## 1. Scope

This contract defines minimum specifications for the `Observe` stage, including multi-source signal collection, context snapshot building, and risk/domain hints organization.

"Perception" is no longer viewed as an independent business plane; it is a historical naming compatibility shell whose actual semantics align with `ObserveHub`.

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
- `type`, value: `rss | web | github | api | custom`
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
- `event_bus_backlog`: pending event count
- `generated_at`

## 5.2 ObservationAggregator

`ObservationAggregator` is the sole output of the Observe stage, aggregating `TaskSituation` + `SystemSituation` into `UnifiedObservation`:

```typescript
interface UnifiedObservation {
  taskSituation: TaskSituation;
  systemSituation: SystemSituation;
  aggregatedAt: string;
}
```

## 6. Behavior Constraints

- Observe must not change the main task chain by default and can only produce signals and `TaskSituation`.
- Observe stage output must be traceable to source ref or signal ref before entering `Assess / Plan`.
- Duplicate information must support deduplication and TTL.
- Observe analysis cost must be trackable and controlled by budget.

## 8. Supplementary Rules

- Information source capability matrix must record at minimum: pull method, frequency, trust level, cost tier, and triggerable action range.
- `TaskSituationBuilder` must produce at minimum: `context_snapshot`, `risk_signals`, `domain_hints`.
- `SystemSituationBuilder` must produce at minimum: `health_status`, `provider_health`, `resource_utilization`, `event_bus_backlog`.
- Proactively creating tasks or triggering actions must go through HQ/system policy by default and must not be directly issued by Observe itself.