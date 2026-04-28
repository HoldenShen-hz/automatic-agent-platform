# ADR-107 Financial Services Explainable Decisions

---

## OAPEFLIR Association

- **Observe**: Collect customer, rules, features, and evidence
- **Assess**: Form financial decisions and rejection reasons
- **Plan**: Generate explanation payload
- **Execute**: Output explainable results
- **Feedback**: Receive fairness and compliance feedback
- **Learn**: Identify bad decision patterns
- **Improve**: Adjust scoring and explanation templates
- **Release**: Financial domain explanation obligation incorporated into acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Automated decisions in the financial services domain must meet explainability and fair lending requirements.

## Decision

- Adverse decisions must be accompanied by a structured explanation
- Explanation must be traceable to evidence and rules

## Consequences

- `financial-services` domain output is no longer just a result; it must also carry reasoning
