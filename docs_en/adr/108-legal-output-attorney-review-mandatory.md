# ADR-108 Legal Output Attorney Review Mandatory

---

## OAPEFLIR Association

- **Observe**: Collect legal issues, evidence, and draft output
- **Assess**: Determine whether attorney review threshold is met
- **Plan**: Form review request and approval path
- **Execute**: Route pre-output to human review before external delivery
- **Feedback**: Record attorney review conclusions
- **Learn**: Archive high-risk legal scenarios
- **Improve**: Optimize legal domain guardrails and templates
- **Release**: Legal domain must retain attorney review闭环

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Legal domain output has high risk; Agent can only provide legal information, cannot directly form un-reviewed legal opinions.

## Decision

- All external or executable output from `legal` domain must be reviewed by a practicing attorney
- Agent output must be retained as drafts and information support materials

## Consequences

- Human-machine collaboration boundary for legal domain is formally written into architecture governance
