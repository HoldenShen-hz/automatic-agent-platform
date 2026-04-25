# ADR-106 Quant Trading Pre Trade Risk Mandatory

---

## OAPEFLIR Association

- **Observe**: Read orders, positions, and risk thresholds
- **Assess**: Perform pre-trade risk assessment
- **Plan**: Decide whether to allow order placement
- **Execute**: Only enter execution chain after risk approval
- **Feedback**: Record block reasons and risk evidence
- **Learn**: Review abnormal order patterns
- **Improve**: Adjust risk parameters
- **Release**: trading domain must pass its own risk gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

The cost of erroneous execution in quant trading domains is extremely high, requiring an independent pre-trade risk boundary separate from the platform's generic risk model.

## Decision

- All trading actions must first pass pre-trade risk
- Hard position and loss limits cannot be overridden by the Agent

## Consequences

- `quant-trading` domain has a non-bypassable pre-trade risk boundary