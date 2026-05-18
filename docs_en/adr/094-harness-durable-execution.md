# ADR-094 Harness Durable Execution

---

## OAPEFLIR Relationship

- **Observe**: Read run, checkpoint, sleep lease, and recovery status
- **Assess**: Determine if recovery or replay is needed
- **Plan**: Plan persist/checkpoint/resume boundaries
- **Execute**: Persist HarnessRun, NodeRun, decision, and context
- **Feedback**: Mark recovery results and unresolved risks
- **Learn**: Analyze failure recovery patterns
- **Improve**: Optimize durable boundaries
- **Release**: Durable capability as Ring 2 durable-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Without persistence, Harness can only do short-term computation, cannot support async, recovery, replay, and long-running tasks.

## Decision

- Durable Harness is responsible for run persistence, checkpoint, restore, resume
- Async run must support pause / resume
- Checkpoint is the authoritative entry point for recovery and replay

## Consequences

- Harness no longer depends on single-process memory to continue running
- Crash recovery and long-running tasks have a unified technical baseline

## v4.3 ADR Remediation

- A-30: This ADR originally used `phase 8b` as the delivery gate terminology. The root cause was that the durable execution ADR followed the historical phase schedule and did not switch to the main architecture's unified ring terminology. Fix: The main text now changed to `Ring 2 durable-readiness`.
