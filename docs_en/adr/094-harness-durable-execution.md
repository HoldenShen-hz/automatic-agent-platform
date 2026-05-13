# ADR-094: Harness Durable Execution

---

## OAPEFLIR Association

- **Observe**: Read run, checkpoint, sleep lease, and recovery state
- **Assess**: Determine whether recovery or replay is needed
- **Plan**: Plan persist/checkpoint/resume boundaries
- **Execute**: Persist HarnessRun, NodeRun, decision, and context
- **Feedback**: Mark recovery results and pending risks
- **Learn**: Analyze fault recovery patterns
- **Improve**: Optimize durable boundary
- **Release**: Durable capability as Ring 2 durable-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Harness without persistence can only do short-duration computation and cannot support async, recovery, replay, and long-running.

## Decision

- Durable Harness is responsible for run persistence, checkpoint, restore, and resume
- Async run must support pause / resume
- Checkpoint is the authoritative entry for recovery and replay

## Consequences

- Harness no longer depends on single-process memory to continue running
- Crash recovery and long-running tasks have a unified technical baseline

## v4.3 ADR Remediation

- A-30: This ADR originally used `phase 8b` as the delivery gate term. Root cause: Durable execution ADR followed the historical phase schedule and did not switch to the main architecture's unified ring caliber. Fix: The text now changes to `Ring 2 durable-readiness`.