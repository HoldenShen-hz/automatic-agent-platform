# ADR-106 Quant Trading Pre Trade Risk Mandatory

---

## OAPEFLIR Association

- **Observe**: Read orders, positions, and risk thresholds
- **Assess**: Perform pre-trade risk checks
- **Plan**: Decide whether execution is allowed
- **Execute**: Permit order flow only after risk approval
- **Feedback**: Record blocked actions and evidence
- **Learn**: Review abnormal trading patterns
- **Improve**: Refine risk parameters
- **Release**: Trading domain must pass its own risk gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Quant trading requires a hard front-loaded risk boundary beyond the generic platform model.

## Decision

- Every trading action must pass pre-trade risk
- Position and loss hard limits cannot be overridden by the agent

## Consequences

- `quant-trading` gains a non-bypassable pre-trade risk boundary
