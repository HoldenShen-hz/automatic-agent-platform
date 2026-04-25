# ADR-099 Harness Async Mode

---

## OAPEFLIR Association

- **Observe**: Receive async queue, sleep lease, and external events
- **Assess**: Decide whether execution can continue
- **Plan**: Plan async resume and rescheduling
- **Execute**: Handle long-running tasks through async harness
- **Feedback**: Record async delay, timeout, and recovery results
- **Learn**: Aggregate async failure patterns
- **Improve**: Optimize async strategy and backlog
- **Release**: Async Harness as phase 8c acceptance item

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Long-running tasks, external waits, and human approvals all require Harness to have a formal async mode.

## Decision

- `AsyncHarnessService` is a first-class Harness subsystem
- Async run needs queue / checkpoint / resume capability
- Sleep / wake / timeout must be part of the same lifecycle model

## Consequences

- Harness can carry genuine async workflows