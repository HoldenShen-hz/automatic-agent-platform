# ADR-099 Harness Async Mode

---

## OAPEFLIR Association

- **Observe**: Receive async queue, sleep lease, and external events
- **Assess**: Determine whether execution can continue
- **Plan**: Plan async recovery and rescheduling
- **Execute**: Handle long-running tasks through async harness
- **Feedback**: Record async delay, timeout, and recovery results
- **Learn**: Summarize async failure patterns
- **Improve**: Optimize async strategy and backlog
- **Release**: Async Harness as Ring 2 async-readiness acceptance item

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Long-running tasks, external waits, and human approval all require Harness to have a formal async mode.

## Decision

- `AsyncHarnessService` serves as Harness's formal subsystem
- Async run needs queue / checkpoint / resume capabilities
- Sleep / wake / timeout must be part of the same lifecycle model

## Consequences

- Harness can承载 true async workflows

## v4.3 ADR Remediation

- A-31: This ADR originally used `phase 8c` as delivery gate terminology,根因 was that async mode ADR followed historical phase scheduling, and did not switch to the主架构 unified ring口径. Fix: The text now changed to `Ring 2 async-readiness`.
