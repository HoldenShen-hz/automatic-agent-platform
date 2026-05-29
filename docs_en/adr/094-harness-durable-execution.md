# ADR-094 Harness Durable Execution

---

## OAPEFLIR Association

- **Observe**: Read run, checkpoint, sleep lease, and recovery status
- **Assess**: Determine if recovery or replay is needed
- **Plan**: Plan persist/checkpoint/resume boundary
- **Execute**: Persist HarnessRun, NodeRun, NodeAttempt, decision, and context
- **Feedback**: Mark recovery results and pending risks
- **Learn**: Analyze failure recovery patterns
- **Improve**: Optimize durable boundary
- **Release**: Durable capability as Ring 2 durable-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Harness without persistence can only do short-term computation, cannot support async, recovery, replay, and long-running.

## Decision

- Durable Harness is responsible for run persistence, checkpoint, restore, resume
- `NodeAttempt` and its receipt/compensation lineage belong to durable replay boundary
- Async run must support pause / resume
- Checkpoint is the authoritative entry point for recovery and replay

## Consequences

- Harness no longer relies on single-process memory to continue running
- Crash recovery and long-running tasks have unified technical baseline

## v4.3 ADR Remediation

- A-30: This ADR originally used `phase 8b` as delivery gate terminology. Root cause: Durable execution ADR沿用 historical stage scheduling, did not switch to main architecture's unified ring terminology. Fix: Body now changed to `Ring 2 durable-readiness`.