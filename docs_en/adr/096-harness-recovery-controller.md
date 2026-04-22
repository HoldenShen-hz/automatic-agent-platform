# ADR-096 Harness Recovery Controller

---

## OAPEFLIR Association

- **Observe**: Receive failure types, checkpoints, and last decisions
- **Assess**: Decide recover / retry / abort / escalate
- **Plan**: Build the recovery path
- **Execute**: Apply recovery actions
- **Feedback**: Record recovery evidence and residual risk
- **Learn**: Build a failure pattern corpus
- **Improve**: Evolve recovery strategy
- **Release**: Recovery control is a phase 8b gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Harness failure handling cannot be delegated to arbitrary callers.

## Decision

- `RecoveryController` owns Harness failure handling
- Recovery actions must be based on checkpoints, durable runs, and decisions
- Recovery flow must write timeline and recovery evidence

## Consequences

- Failure handling is centralized
