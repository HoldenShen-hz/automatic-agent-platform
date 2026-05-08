# ADR-096 Harness Recovery Controller

---

## OAPEFLIR Association

- **Observe**: Receive failure type, checkpoint, and last decision
- **Assess**: Determine recover / retry / abort / escalate
- **Plan**: Plan recovery path and repair boundary
- **Execute**: Apply recovery actions
- **Feedback**: Record recovery evidence and residual risk
- **Learn**: Accumulate failure patterns into learning pipeline
- **Improve**: Enhance recovery strategy
- **Release**: Recovery control as Phase 8b gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Harness failure recovery cannot rely on the caller to decide freely, as this would undermine consistency and auditing.

## Decision

- `RecoveryController` is responsible for unified handling of Harness failures
- Recovery actions must be based on checkpoint / durable run / decision state
- Recovery process must write timeline and recovery evidence

## Consequences

- Failure handling is no longer fragmented
- Replay, repair, and resume share the same recovery model
