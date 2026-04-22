# ADR-099 Harness Async Mode

---

## OAPEFLIR Association

- **Observe**: Receive async queue, sleep leases, and external events
- **Assess**: Decide whether execution can continue
- **Plan**: Build resume and redispatch plans
- **Execute**: Run long-lived work through async harness
- **Feedback**: Record delays, timeouts, and recovery outcomes
- **Learn**: Aggregate async failure patterns
- **Improve**: Refine async strategy and backlog handling
- **Release**: Async Harness is part of phase 8c acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Long-running tasks and external waits require a formal async mode.

## Decision

- `AsyncHarnessService` is a first-class Harness subsystem
- Async runs require queue, checkpoint, and resume support
- Sleep / wake / timeout share one lifecycle model

## Consequences

- Harness can support genuine asynchronous workflows
