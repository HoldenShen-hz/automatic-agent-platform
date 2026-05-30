# Perception Contract

> **OAPEFLIR Related**: This contract defines the OAPEFLIR Observe Hub, corresponding to ADR-016 §3 and G6 solution.
> **Updated**: 2026-04-17

> Compatibility Note: Filename `perception_contract.md` is retained to maintain historical link stability; the current authoritative semantics have been closed into the OAPEFLIR `Observe` stage.

## 1. Scope

This contract defines the minimal specification for the `Observe` stage, including multi-source signal collection, context snapshot building, and risk/domain hint organization.

"Perception" is no longer considered an independent business plane; it is a historical naming compatibility shell, with actual semantics aligned to `ObserveHub`.

## 2. Key Objects

- `ObserveSource`
- `ObserveSignal`
- `TaskSituation`
- `SystemSituation`
- `TaskSituationBuilder`
- `SystemSituationBuilder`
- `ObservationAggregator`
- `ObserveSchedule`

## 3. ObserveSource Minimal Fields

- `source_id`
- `type`, values: `rss | web | github | api | custom`
- `name`
- `enabled`
- `schedule`
- `filters`
- `priority`
- `trust_tier?`

## 4. ObserveSignal Minimal Fields

- `signal_id`
- `source_id`
- `kind`
- `summary`
- `raw_ref`
- `relevance_score`
- `risk_score?`
- `domain_hints?`
- `captured_at`

## 5. TaskSituation Minimal Fields

- `task_id`
- `context_snapshot`
- `risk_signals`
- `domain_hints`
- `source_refs`
- `generated_at`

## 5.1 SystemSituation Minimal Fields

- `health_status`: `ok | degraded | overloaded | unhealthy`
- `provider_health`: Map<providerId, { available, latencyP99 }>
- `resource_utilization`: { memoryMB, cpuPercent, activeProcesses }
- `event_bus_backlog`: pending event count
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

- Observe does not modify the main task chain by default; it can only produce signals and `TaskSituation`.
- Observe stage outputs entering `Assess / Plan` must be traceable to source ref or signal ref.
- Duplicate information must support deduplication and TTL.
- Observe analysis costs must be trackable and subject to budget control.

## 8. Supplementary Rules

- Information source capability matrix must record at minimum: pull method, frequency, trustworthiness, cost tier, and actionable scope.
- `TaskSituationBuilder` must produce at minimum: `context_snapshot`, `risk_signals`, `domain_hints`.
- `SystemSituationBuilder` must produce at minimum: `health_status`, `provider_health`, `resource_utilization`, `event_bus_backlog`.
- Active task creation or action triggering defaults to going through HQ/system policy and must not be directly issued by Observe itself.