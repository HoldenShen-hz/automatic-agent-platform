# ADR-107 Financial Services Explainable Decisions

---

## OAPEFLIR Association

- **Observe**: Gather customer facts, rules, and evidence
- **Assess**: Produce the financial decision and denial rationale
- **Plan**: Build explanation payloads
- **Execute**: Return explainable outputs
- **Feedback**: Receive fairness and compliance feedback
- **Learn**: Identify problematic decision patterns
- **Improve**: Refine scoring and explanation templates
- **Release**: Explanation duty is part of financial-domain acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Automated decisions in financial services require structured explanations and traceability.

## Decision

- Any adverse decision must include a structured explanation
- The explanation must trace back to evidence and rule application

## Consequences

- `financial-services` outputs must include reasons, not only outcomes
