# Perception Contract

> Compatibility note: Filename is kept as `perception_contract.md` to maintain historical link stability; current authoritative semantics have converged to the OAPEFLIR `Observe` stage.

## 1. Scope

This contract defines the minimum specification for the `Observe` stage, including multi-source signal collection, context snapshot construction, and risk/domain hint organization.

Currently, "perception" is no longer treated as an independent business surface; it is a historical naming compatibility shell whose actual semantics align with `ObserveHub`.

## 2. Key Objects

- `ObserveSource`
- `ObserveSignal`
- `TaskSituation`
- `TaskSituationBuilder`
- `ObserveSchedule`

## 3. ObserveSource Minimum Fields

- `source_id`
- `type`, value range `rss | web | github | api | custom`
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

## 6. Behavioral Constraints

- Observe does not by default change the main task chain and can only produce signals and `TaskSituation`.
- Observe stage output must be traceable to source ref or signal ref before entering `Assess / Plan`.
- Duplicate information must support deduplication and TTL.
- Observe analysis cost must be traceable and controlled by budget.

## 7. Supplementary Rules

- Information source capability matrix at minimum records: pull method, frequency, credibility, cost level, and triggerable action range.
- `TaskSituationBuilder` at minimum produces: `context_snapshot`, `risk_signals`, `domain_hints`.
- Active task creation or action triggering defaults to going through HQ/system policy and must not be directly issued by Observe itself.
