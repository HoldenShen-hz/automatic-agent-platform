# ADR-018 Rollout Eleven-State Machine

- Status: Accepted
- Decision Date: 2026-04-17

## Background

The rollout system requires controlled release of improvements to production with state machine-driven transitions to ensure safety and observability.

## Decision

### Eleven Rollout States

| State | Description |
|-------|-------------|
| `draft` | Initial state, candidate not yet submitted |
| `submitted` | Submitted for review |
| `reviewing` | Under review/evaluation |
| `approved` | Approved for rollout |
| `shadow` | Running in shadow mode (monitoring only) |
| `canary` | Released to small percentage |
| `staged` | Released to staged rollout |
| `full` | Fully released |
| `paused` | Rollout paused |
| `rolled_back` | Rolled back |
| `superseded` | Superseded by newer version |

### State Transitions

```
draft → submitted → reviewing → approved → shadow → canary → staged → full
                                    ↓           ↓         ↓         ↓
                                paused     paused   paused   paused
                                    ↓           ↓         ↓         ↓
                              rolled_back rolled_back rolled_back rolled_back
```

### Rollout Guardrails

- All transitions must be logged
- Rollback must preserve evidence
- Shadow mode must meet success criteria before canary
- Canary must meet stability threshold before staged
- Staged must meet full rollout criteria

## Cross References

- [ADR-007 Evolution Engine](./007-evolution-engine.md)
- [ADR-016 OAPEFLIR Loop Model](./016-oapeflir-loop-model.md)
