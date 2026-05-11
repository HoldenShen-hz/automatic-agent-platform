# ADR-108 Legal Output Attorney Review Mandatory

---

## OAPEFLIR Association

- **Observe**: Collect legal issues, evidence, and draft outputs
- **Assess**: Determine whether the attorney review threshold has been met
- **Plan**: Formulate review requests and approval paths
- **Execute**: Route outgoing pre-release outputs to human review
- **Feedback**: Record attorney review conclusions
- **Learn**: Archive high-risk legal scenarios
- **Improve**: Optimize legal domain guardrails and templates
- **Release**: Legal domain must retain attorney review closed loop

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Legal domain outputs carry high risk. Agents can only provide legal information and cannot directly form unreviewed legal opinions.

## Decision

- All outgoing or executable outputs from the `legal` domain must undergo review by a licensed attorney
- Agent outputs must remain in draft form and serve as informational supporting materials

## Consequences

- The human-machine collaboration boundary for the legal domain is formally written into architectural governance
