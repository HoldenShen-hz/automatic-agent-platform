# ADR-108: Legal Output Attorney Review Mandatory

---

## OAPEFLIR Association

- **Observe**: Collect legal issues, evidence, and draft output
- **Assess**: Determine whether attorney review threshold is met
- **Plan**: Form review request and approval path
- **Execute**: Transfer pre-release output to human review
- **Feedback**: Record attorney review conclusion
- **Learn**: Archive high-risk legal scenarios
- **Improve**: Optimize legal domain guardrails and templates
- **Release**: Legal domain must retain attorney review closed loop

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Legal domain output has high risk; Agent can only provide legal information and cannot directly form unreviewed legal opinions.

## Decision

- All external or executable output from `legal` domain must be reviewed by a practicing attorney
- Agent output must be retained as draft and information support material

## Consequences

- Human-machine collaboration boundary in legal domain is formally written into architecture governance