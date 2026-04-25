# ADR-108 Legal Output Attorney Review Mandatory

---

## OAPEFLIR Association

- **Observe**: Collect legal issues, evidence, and draft outputs
- **Assess**: Decide whether attorney review threshold is met
- **Plan**: Form review request and approval path
- **Execute**: Route pre-external output to human review
- **Feedback**: Record attorney review conclusions
- **Learn**: Archive high-risk legal scenarios
- **Improve**: Optimize legal domain guardrails and templates
- **Release**: legal domain must retain attorney review closure

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Legal domain output is high-risk, and the Agent can only provide legal information, not directly form un-reviewed legal opinions.

## Decision

- All external or actionable `legal` outputs must be reviewed by a licensed attorney
- Agent output must remain draft material and information support

## Consequences

- The human-robot collaboration boundary for the legal domain is formally written into architecture governance