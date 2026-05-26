# ADR-094 Harness Durable Execution

---

## OAPEFLIR Association

- **Observe**: Read run, checkpoint, sleep lease, and recovery state
- **Assess**: Determine whether recovery or replay is needed
- **Plan**: Plan persist/checkpoint/resume boundaries
- **Execute**: Persist HarnessRun, NodeRun, NodeAttempt, decision, and context
- **Feedback**: Mark recovery results and unresolved risks
- **Learn**: Analyze fault recovery patterns
- **Improve**: Optimize durable boundary
- **Release**: Durable capability as Ring 2 durable-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Harness without persistence can only do short-duration computation, cannot support async, recovery, replay, and long-running.

## Decision

- Durable Harness is responsible for run persistence, checkpoint, restore, resume
- `NodeAttempt` and its receipt / compensation lineage are part of durable replay boundary
- Async run must support pause / resume
- Checkpoint is the authoritative entry for recovery and replay

## Consequences

- Harness no longer depends on single-process memory to continue running
- Crash recovery and long-running tasks have unified technical baseline

## v4.3 ADR Remediation

- A-30: This ADR originally used `phase 8b` as delivery gate terminology, root cause being durable execution ADR followed historical phase scheduling, did not switch to main architecture unified ring口径. Fix: Main text now changed to `Ring 2 durable-readiness`.
