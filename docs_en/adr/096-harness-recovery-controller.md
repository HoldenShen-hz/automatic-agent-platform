# ADR-096 Harness Recovery Controller

---

## OAPEFLIR Association

- **Observe**: Receive failure type, checkpoint, and last decision
- **Assess**: Determine recover / retry / abort / escalate
- **Plan**: Plan recovery path and repair boundary
- **Execute**: Apply recovery actions
- **Feedback**: Record recovery evidence and residual risks
- **Learn**: Precipitate failure patterns to learning pipeline
- **Improve**: Improve recovery strategy
- **Release**: Recovery control as durable-readiness gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Harness failure recovery cannot rely on caller free decision, otherwise will break consistency and audit.

## Decision

- `RecoveryController` is responsible for unified Harness failure handling
- Recovery actions must be based on checkpoint / durable run / decision state
- Recovery process must write timeline and recovery evidence

## Consequences

- Failure handling no longer scattered
- Replay, repair, resume share same recovery model
