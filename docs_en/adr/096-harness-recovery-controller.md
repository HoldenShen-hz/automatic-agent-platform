# ADR-096 Harness Recovery Controller

---

## OAPEFLIR Association

- **Observe**: Receive failure types, checkpoints, and last decisions
- **Assess**: Decide recover / retry / abort / escalate
- **Plan**: Build recovery path and repair boundary
- **Execute**: Apply recovery actions
- **Feedback**: Record recovery evidence and residual risk
- **Learn**: Deposit failure patterns into learning pipeline
- **Improve**: Enhance recovery strategy
- **Release**: Recovery control as phase 8b gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Harness failure recovery cannot be left to arbitrary caller decisions, or it will break consistency and auditability.

## Decision

- `RecoveryController` owns unified Harness failure handling
- Recovery actions must be based on checkpoint / durable run / decision state
- Recovery flow must write to timeline and recovery evidence

## Consequences

- Failure handling is no longer scattered
- Replay, repair, and resume share the same recovery model