# ADR-108 Legal Output Attorney Review Mandatory

---

## OAPEFLIR Association

- **Observe**: Collect legal issues, evidence, and draft output
- **Assess**: Determine if attorney review threshold is met
- **Plan**: Form review request and approval path
- **Execute**: Divert pre-release output to human review
- **Feedback**: Record attorney review conclusions
- **Learn**: Archive high-risk legal scenarios
- **Improve**: Optimize legal domain guardrails and templates
- **Release**: legal domain must retain attorney review loop

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Legal domain output carries high risk; Agent can only provide legal information and cannot directly form unreviewed legal opinions.

## Decision

- All external or executable output from `legal` domain must be reviewed by a licensed attorney
- Agent output must remain as draft and information support material

## Consequences

- Human-machine collaboration boundary for legal domain is formally written into architecture governance
