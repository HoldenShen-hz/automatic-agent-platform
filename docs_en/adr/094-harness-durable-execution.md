# ADR-094 Harness Durable Execution

---

## OAPEFLIR Association

- **Observe**: Read run, checkpoint, sleep lease, and recovery state
- **Assess**: Determine whether recovery or replay is needed
- **Plan**: Plan persist/checkpoint/resume boundaries
- **Execute**: Persist HarnessRun, NodeRun, decision, and context
- **Feedback**: Mark recovery results and pending risks
- **Learn**: Analyze fault recovery patterns
- **Improve**: Optimize durable boundaries
- **Release**: Durable capability as Ring 2 durable-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Without persistence, a Harness can only perform short-lived computations and cannot support async, recovery, replay, or long-running tasks.

## Decision

- Durable Harness is responsible for run persistence, checkpoint, restore, and resume
- Async runs must support pause / resume
- Checkpoint is the authoritative entry point for recovery and replay

## Consequences

- Harness no longer depends on single-process memory to continue running
- Crash recovery and long-running tasks share a unified technical baseline

## v4.3 ADR Remediation

- A-30: This ADR originally used `phase 8b` as the delivery gate terminology. The root cause is that the durable execution ADR followed historical phase scheduling and did not switch to the main architecture's unified ring terminology. Fix: The body now uses `Ring 2 durable-readiness`.
