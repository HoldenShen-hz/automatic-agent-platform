# ADR-111: Platform Fact vs OAPEFLIR View Events

## Status

Accepted

## Decision Date

2026-04-27

## Context

OAPEFLIR in v4.3 is a controlled cognition and governance framework, not a second execution runtime. In historical events, `oapeflir.*` has simultaneously expressed phase semantics, runtime facts, and diagnostic views, which prevents truth projector from determining which events can change authoritative state.

## Decision

1. `platform.*` events are the sole truth fact event namespace.
2. `oapeflir.view.*` and `oapeflir.rationale.*` only express StageRationale, TraceProjection, Audit View, and explanation views.
3. Truth projector, recovery scanner, budget projector, and side-effect projector can only consume `platform.*`.
4. OAPEFLIR view projector can consume `platform.*` and derive `oapeflir.view.*`, but must not inversely drive `HarnessRun`, `NodeRun`, `Budget`, or `SideEffect` truth.
5. Legacy event adapter if receiving historical `oapeflir.*` events must label `derivedFromEventId`, `projectionOnly=true`, and compatibility source, and must not masquerade as platform fact.

## Event Hierarchy

| Level | namespace | Purpose | Can Drive Truth |
| --- | --- | --- | --- |
| Platform fact | `platform.*` | State transition, budget, approval, side effect, audit fact | Yes |
| OAPEFLIR view | `oapeflir.view.*` | Stage view, explanation timeline, diagnostic projection | No |
| OAPEFLIR rationale | `oapeflir.rationale.*` | Cognitive rationale, evaluation explanation, learning release notes | No |
| Legacy event | Historical `task.*` / `workflow.*` / `oapeflir.*` | Compatibility read or migration input | No, unless explicitly adapter-converted to platform fact |

## Consequences

- New event consumer test: truth consumer does not consume `oapeflir.view.*`.
- Event registry must登记 producer, consumer, replay, and projection semantics.
- Trace Replay uses platform facts as default audit capability; Re-execution Replay output can only enter isolated evidence namespace.

## Related Documents

- [109-contract-freeze.md](./109-contract-freeze.md)
- [event_registry_and_ops_threshold_contract.md](../contracts/event_registry_and_ops_threshold_contract.md)
- [event-envelope-contract.md](../contracts/event-envelope-contract.md)
