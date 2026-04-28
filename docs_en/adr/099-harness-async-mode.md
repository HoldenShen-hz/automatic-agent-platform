# ADR-099 Harness Async Mode

---

## OAPEFLIR Association

- **Observe**: Receive async queue, sleep lease, and external events
- **Assess**: Determine if execution can continue
- **Plan**: Plan async recovery and rescheduling
- **Execute**: Handle long-running tasks via async harness
- **Feedback**: Record async delay, timeout, and recovery results
- **Learn**: Aggregate async failure patterns
- **Improve**: Optimize async strategy and backlog
- **Release**: Async Harness as Ring 2 async-readiness acceptance item

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Long-running tasks, external waits, and human approvals all require Harness to have a formal async mode.

## Decision

- `AsyncHarnessService` as formal subsystem of Harness
- Async run requires queue / checkpoint / resume capability
- Sleep / wake / timeout must be part of the same lifecycle model

## Consequences

- Harness can now host true async workflows

## v4.3 ADR Remediation

- A-31: This ADR originally used `phase 8c` as delivery gate terminology. The root cause was that the async mode ADR followed historical phase scheduling and did not switch to the main architecture's unified ring terminology. Fix: The body now uses `Ring 2 async-readiness`.
