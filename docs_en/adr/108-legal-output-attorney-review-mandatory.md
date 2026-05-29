# ADR-108 Legal Output Attorney Review Mandatory

---

## OAPEFLIR Association

- **Observe**: Collect legal issues, evidence, and draft outputs
- **Assess**: Determine if attorney review threshold is reached
- **Plan**: Form review request and approval path
- **Execute**: Transfer pre-distribution output to human review
- **Feedback**: Record attorney review conclusions
- **Learn**: Archive high-risk legal scenarios
- **Improve**: Optimize legal domain guardrails and templates
- **Release**: Legal domain must retain attorney review闭环

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Legal domain output has high risk; Agent can only provide legal information, cannot directly form unreviewed legal opinions.

## Decision

- All outgoing or executable output from `legal` domain must be reviewed by practicing attorney
- Agent output must be retained as draft and information support material

## Consequences

- Human-machine collaboration boundary for legal domain is formally written into architecture governance