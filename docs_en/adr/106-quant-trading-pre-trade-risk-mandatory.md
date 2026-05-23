# ADR-106 Quant Trading Pre Trade Risk Mandatory

---

## OAPEFLIR Association

- **Observe**: Read orders, positions, and risk control thresholds
- **Assess**: Perform pre-trade risk assessment
- **Plan**: Decide whether to allow order placement
- **Execute**: Only enter execution chain after risk control passes
- **Feedback**: Record blocking reasons and risk control evidence
- **Learn**: Review abnormal order patterns
- **Improve**: Adjust risk control parameters
- **Release**: Trading domain must pass exclusive risk gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

The cost of erroneous execution in quantitative trading domain is extremely high, and must have pre-trade risk control independent of platform general risk.

## Decision

- All trading actions must first pass pre-trade risk
- Hard position and loss limits cannot be overridden by Agent

## Consequences

- `quant-trading` domain has non-bypassable pre-trade risk boundaries
