# ADR-018 Rollout Eleven-State Machine and Six-Phase Release

- Status: Accepted
- Decision Date: 2026-04-17

## Context

§9 defines five-level release (L0-L5) and 11-state RolloutStatus state machine. Current `rollout-state-machine.ts` only implements 3 states (off → suggest → shadow), cannot support progressive release (canary → staged → stable) and auto rollback.

## Decision

### Eleven-State RolloutStatus Enum

```
draft
  ↓ (guardrail pass)
pending_approval
  ↓           ↓ (rejected)
shadow        rejected
  ↓ (24h)
canary_5      ← 5% traffic
  ↓ (metrics gate: error_rate < 0.5%, p99 < 2x baseline)
partial_25    ← 25% traffic
  ↓
partial_50    ← 50% traffic
  ↓
partial_75    ← 75% traffic
  ↓
stable        ← 100% traffic, considered adopted
  ↓
rolled_back   ← auto or manual rollback
  ↓
paused        ← paused, can resume
```

### Five-Level Release

| Level | Name | Traffic | Applicable Scenario |
|-------|------|---------|---------------------|
| L0 | off | 0% | Disabled |
| L1 | suggest | 0% | Suggestion only, not auto-executed |
| L2 | shadow | 0% | Shadow mode, does not affect production |
| L3 | canary | 1-10% | Small traffic verification |
| L4 | staged | 25-75% | Gray release |
| L5 | stable | 100% | Full release |

### Auto Rollback Rules

When any of the following conditions are met, automatically trigger `rolled_back`:

- `failureRate > 5%` (5-minute window)
- `p99Latency > 2x baseline`

### Current Implementation Status

- `src/core/improvement/rollout/rollout-state-machine.ts`: 3/11 states, needs expansion.
- `src/core/improvement/auto-rollback-service.ts`: To create.
- `src/core/improvement/canary-traffic-router.ts`: To create.

## Consequences

- Rollout state machine expansion is core work of Sprint 2 (GAP-V2-07).
- Complete 11-state + auto rollback enables production-grade progressive release capability.
- RolloutRecord must persist all state transition history for audit and RCA.
