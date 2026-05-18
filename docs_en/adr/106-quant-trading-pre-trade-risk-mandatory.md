# ADR-106 Quant Trading Pre Trade Risk Mandatory

---

## OAPEFLIR Association

- **Observe**: Read orders, positions, and risk thresholds
- **Assess**: Perform pre-trade risk assessment
- **Plan**: Decide whether to allow order submission
- **Execute**: Only enter execution chain after risk passes
- **Feedback**: Record blocking reasons and risk evidence
- **Learn**: Review abnormal order patterns
- **Improve**: Adjust risk parameters
- **Release**: trading domain must pass domain-specific risk gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Quant trading domain has extremely high cost of erroneous execution; must have pre-trade risk independent of platform generic risk.

## Decision

- All trading actions must first pass pre-trade risk
- Hard position and loss limits cannot be overridden by Agent

## Consequences

- `quant-trading` domain has non-bypassable pre-trade risk boundary
