# ADR-106: Quant Trading Pre Trade Risk Mandatory

---

## OAPEFLIR Association

- **Observe**: Read orders, positions, and risk control thresholds
- **Assess**: Perform pre-trade risk assessment
- **Plan**: Decide whether to allow order placement
- **Execute**: Only enter execution chain after risk control passes
- **Feedback**: Record blocking reason and risk control evidence
- **Learn**: Review abnormal order patterns
- **Improve**: Adjust risk control parameters
- **Release**: Trading domain must pass exclusive risk gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

The cost of erroneous execution in quant trading domain is extremely high, requiring independent pre-trade risk control separate from platform general risk.

## Decision

- All trading actions must first pass pre-trade risk
- Hard position and loss limits cannot be overridden by Agent

## Consequences

- `quant-trading` domain has an unavoidable pre-trade risk boundary