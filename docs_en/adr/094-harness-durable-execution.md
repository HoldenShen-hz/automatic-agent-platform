# ADR-094 Harness Durable Execution

---

## OAPEFLIR Association

- **Observe**: Read run, checkpoint, sleep lease, and recovery state
- **Assess**: Decide whether restore or replay is required
- **Plan**: Define persist/checkpoint/resume boundaries
- **Execute**: Persist run, step, decision, and context state
- **Feedback**: Mark recovery outcome and residual risk
- **Learn**: Analyze recovery patterns
- **Improve**: Evolve durable boundaries
- **Release**: Durable capability as phase 8b acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Non-durable Harness can only support short-lived computation and cannot support async, recovery, replay, or long-running tasks.

## Decision

- Durable Harness owns persistence, checkpoint, restore, and resume
- Async run must support pause / resume
- Checkpoint is the authoritative entrypoint for recovery and replay

## Consequences

- Harness no longer depends on single-process memory to continue
- Crash recovery and long-running tasks share a unified technical baseline