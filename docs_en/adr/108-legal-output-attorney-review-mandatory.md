# ADR-108 Legal Output Attorney Review Mandatory

---

## OAPEFLIR Association

- **Observe**: Collect legal issues, evidence, and draft output
- **Assess**: Determine whether attorney review threshold is met
- **Plan**: Form review request and approval path
- **Execute**: Route pre-release output to human review before external sending
- **Feedback**: Record attorney review conclusions
- **Learn**: Archive high-risk legal scenarios
- **Improve**: Optimize legal domain guardrails and templates
- **Release**: Legal domain must retain attorney review loop

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Legal domain output has high risk, and Agent can only provide legal information, and cannot directly form un-reviewed legal opinions.

## Decision

- All external or executable output from `legal` domain must be reviewed by practicing attorney
- Agent output must be retained as draft and information support material

## Consequences

- Legal domain human-machine collaboration boundary is formally written into architecture governance
