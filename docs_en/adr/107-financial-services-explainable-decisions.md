# ADR-107: Financial Services Explainable Decisions

---

## OAPEFLIR Relationship

- **Observe**: Collect customers, rules, features, and evidence
- **Assess**: Form financial decisions and rejection reasons
- **Plan**: Generate explanation payload
- **Execute**: Output explainable results
- **Feedback**: Receive fairness and compliance feedback
- **Learn**: Identify bad decision patterns
- **Improve**: Adjust scoring and explanation templates
- **Release**: Financial domain explanation obligation enters acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Automated decisions in financial services domain must meet explainability and fair lending requirements.

## Decision

- Adverse decisions must be accompanied by structured explanation
- Explanation must be traceable to evidence and rules

## Consequences

- `financial-services` domain output no longer just contains results, but must also carry rationale