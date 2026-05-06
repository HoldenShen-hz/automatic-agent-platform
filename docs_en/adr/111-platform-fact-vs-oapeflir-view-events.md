# ADR-111: Platform Fact vs OAPEFLIR View Events

## Status

Accepted

## Decision Date

2026-04-27

## Context

OAPEFLIR is a controlled cognition and governance framework in v4.3, not a second set of execution runtime. In historical events, `oapeflir.*` simultaneously expressed stage semantics, runtime facts, and diagnostic views, which makes it impossible for the truth projector to determine which events can change authoritative state.

## Decision

1. `platform.*` events are the sole truth fact event namespace.
2. `oapeflir.view.*` and `oapeflir.rationale.*` only express StageRationale, TraceProjection, Audit View, and explanation views.
3. Truth projector, recovery scanner, budget projector, and side-effect projector can only consume `platform.*`.
4. OAPEFLIR view projector can consume `platform.*` and derive `oapeflir.view.*`, but cannot reversely drive `HarnessRun`, `NodeRun`, `Budget`, or `SideEffect` truth.
5. Legacy event adapters receiving historical `oapeflir.*` events must mark `derivedFromEventId`, `projectionOnly=true`, and compatibility source, and cannot impersonate platform fact.

## Event Hierarchy

| Layer | namespace | Purpose | Can Drive Truth |
| --- | --- | --- | --- |
| Platform fact | `platform.*` | State progression, budget, approval, side effects, audit facts | Yes |
| OAPEFLIR view | `oapeflir.view.*` | Stage view, explanation timeline, diagnostic projection | No |
| OAPEFLIR rationale | `oapeflir.rationale.*` | Cognitive rationale, assessment explanation, learning publication notes | No |
| Legacy event | Historical `task.*` / `workflow.*` / `oapeflir.*` | Compatible read or migration input | No, unless explicitly adapted to platform fact |

## Consequences

- New event consumer test: truth consumer does not consume `oapeflir.view.*`.
- Event registry must register producer, consumer, replay, and projection semantics.
- Trace Replay uses platform facts as default audit capability; Re-execution Replay output can only enter isolated evidence namespace.

## Related Documents

- [109-contract-freeze.md](./109-contract-freeze.md)
- [event_registry_and_ops_threshold_contract.md](../contracts/event_registry_and_ops_threshold_contract.md)
- [event-envelope-contract.md](../contracts/event-envelope-contract.md)
