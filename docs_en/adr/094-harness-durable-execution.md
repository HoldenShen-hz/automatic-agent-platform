# ADR-094 Harness Durable Execution

---

## OAPEFLIR Association

- **Observe**: Read run, checkpoint, sleep lease, and recovery state
- **Assess**: Determine whether recovery or replay is needed
- **Plan**: Plan persist/checkpoint/resume boundaries
- **Execute**: Persist HarnessRun, NodeRun, NodeAttempt, and context (step is a semantic projection, not persistent truth; NodeRun/NodeAttempt is the persistent execution unit)
- **Feedback**: Mark recovery results and pending risks
- **Learn**: Analyze failure recovery patterns
- **Improve**: Optimize durable boundary
- **Release**: Durable capability as Ring 2 durable-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Harness without persistence can only perform short-duration computations and cannot support async, recovery, replay, and long-running operations.

## Decision

- Durable Harness is responsible for run persistence, checkpoint, restore, and resume
- Async runs must support pause / resume
- Checkpoint is the authoritative entry point for recovery and replay

## Consequences

- Harness no longer depends on single-process memory to continue running
- Crash recovery and long-running tasks have a unified technical baseline

## v4.3 ADR Remediation

- A-30: This ADR originally used `phase 8b` as the delivery gate terminology, because the durable execution ADR followed the historical phase schedule and did not switch to the main architecture's unified ring terminology. Fix: The main text now changes to `Ring 2 durable-readiness`.
