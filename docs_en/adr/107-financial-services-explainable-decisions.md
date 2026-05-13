# ADR-107: Financial Services Explainable Decisions

---

## OAPEFLIR Association

- **Observe**: Collect customer, rules, features, and evidence
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

Automated decisions in financial services domain must meet explainable and fair lending requirements.

## Decision

- Adverse decisions must carry structured explanation
- Explanation must be traceable to evidence and rules

## Consequences

- `financial-services` domain output not only carries results, but also reasons