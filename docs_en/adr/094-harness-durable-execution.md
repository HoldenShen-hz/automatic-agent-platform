# ADR-094 Harness Durable Execution

---

## OAPEFLIR Association

- **Observe**: Read runs, checkpoints, sleep leases, and recovery state
- **Assess**: Decide whether restore or replay is required
- **Plan**: Define persist/checkpoint/resume boundaries
- **Execute**: Persist run, step, decision, and context state
- **Feedback**: Mark recovery outcome and residual risk
- **Learn**: Analyze recovery patterns
- **Improve**: Evolve durable boundaries
- **Release**: Durable behavior is a phase 8b gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Non-durable Harness can only support short-lived execution.

## Decision

- Durable Harness owns persistence, checkpoints, restore, and resume
- Async runs must support pause / resume
- Checkpoints are the authoritative entrypoint for recovery and replay

## Consequences

- Harness no longer depends on process memory to continue
