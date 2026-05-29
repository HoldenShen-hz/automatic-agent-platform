# ADR-107 Financial Services Explainable Decisions

---

## OAPEFLIR Association

- **Observe**: Collect customer, rules, features, and evidence
- **Assess**: Form financial decision and rejection reasons
- **Plan**: Generate explanation payload
- **Execute**: Output explainable results
- **Feedback**: Receive fairness and compliance feedback
- **Learn**: Identify bad decision patterns
- **Improve**: Adjust scoring and explanation templates
- **Release**: Financial domain explainability obligations included in acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Automated decisions in financial services domain must satisfy explainability and fair lending requirements.

## Decision

- Adverse decisions must be accompanied by structured explanation
- Explanation must be traceable to evidence and rules

## Consequences

- `financial-services` domain output is no longer just results, but must also carry reasoning