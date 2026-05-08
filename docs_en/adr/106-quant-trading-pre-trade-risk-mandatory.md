# ADR-106 Quant Trading Pre Trade Risk Mandatory

---

## OAPEFLIR Association

- **Observe**: Read orders, positions, and risk control thresholds
- **Assess**: Perform pre-trade risk assessment
- **Plan**: Decide whether to allow order submission
- **Execute**: Only enter execution chain after risk control passes
- **Feedback**: Record block reason and risk control evidence
- **Learn**: Review abnormal order patterns
- **Improve**: Adjust risk control parameters
- **Release**: Trading domain must pass domain-specific risk gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

The cost of erroneous execution in the quant trading domain is extremely high; it must have pre-trade risk control independent of the platform's general risk controls.

## Decision

- All trading actions must first pass pre-trade risk
- Hard position and loss limits cannot be overridden by Agent

## Consequences

- `quant-trading` domain has a non-bypassable pre-trade risk boundary
