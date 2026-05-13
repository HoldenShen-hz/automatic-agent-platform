# ADR-099: Harness Async Mode

---

## OAPEFLIR Association

- **Observe**: Receive async queue, sleep lease, and external events
- **Assess**: Determine whether execution can continue
- **Plan**: Plan async recovery and rescheduling
- **Execute**: Process long-running tasks through async harness
- **Feedback**: Record async delay, timeout, and recovery results
- **Learn**: Summarize async failure patterns
- **Improve**: Optimize async strategy and backlog
- **Release**: Async Harness as Ring 2 async-readiness acceptance item

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Long-running tasks, external waits, and human approval all require Harness to have a formal async mode.

## Decision

- `AsyncHarnessService` serves as the formal subsystem of Harness
- Async run needs queue / checkpoint / resume capability
- Sleep / wake / timeout must be part of the same lifecycle model

## Consequences

- Harness can carry true async workflows

## v4.3 ADR Remediation

- A-31: This ADR originally used `phase 8c` as the delivery gate term. Root cause: Async mode ADR followed the historical phase schedule and did not switch to the main architecture's unified ring caliber. Fix: The text now changes to `Ring 2 async-readiness`.