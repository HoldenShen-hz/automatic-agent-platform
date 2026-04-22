# ADR-108 Legal Output Attorney Review Mandatory

---

## OAPEFLIR Association

- **Observe**: Gather legal requests, evidence, and draft outputs
- **Assess**: Decide whether attorney review is mandatory
- **Plan**: Produce review requests and approval routing
- **Execute**: Route external-facing output through human review
- **Feedback**: Record attorney decisions
- **Learn**: Capture high-risk legal patterns
- **Improve**: Strengthen legal guardrails and templates
- **Release**: Legal domain requires attorney review closure

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Legal domain output is high-risk and must remain draft or informational until licensed review.

## Decision

- All external or actionable `legal` outputs require licensed attorney review
- Agent output remains draft material and legal information support

## Consequences

- The human-review boundary for the legal domain is formally captured in architecture governance
