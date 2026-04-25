# ADR-107 Financial Services Explainable Decisions

---

## OAPEFLIR Association

- **Observe**: Gather customers, rules, characteristics, and evidence
- **Assess**: Form financial decisions and denial reasons
- **Plan**: Generate explanation payloads
- **Execute**: Output explainable results
- **Feedback**: Receive fairness and compliance feedback
- **Learn**: Identify problematic decision patterns
- **Improve**: Adjust scoring and explanation templates
- **Release**: Explanation obligation is part of financial domain acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Automated decisions in financial services domains must meet explainability and fair lending requirements.

## Decision

- Adverse decisions must include structured explanations
- Explanations must be traceable to evidence and rules

## Consequences

- `financial-services` domain output is no longer just results, but must also include reasons