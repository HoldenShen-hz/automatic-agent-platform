# ADR-101 Domain Risk Override Over Platform Default

---

## OAPEFLIR Association

- **Observe**: Platform default risk matrix and domain-specific risk inputs
- **Assess**: Determine whether domain override is allowed
- **Plan**: Formulate domain risk profile
- **Execute**: Apply domain risk priority before task execution
- **Feedback**: Record override rationale and audit evidence
- **Learn**: Identify high-risk domain commonalities
- **Improve**: Optimize domain risk baseline
- **Release**: High-risk domain must complete override review before go-live

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

The platform default risk matrix is insufficient to cover highly sensitive domains such as finance, legal, and healthcare.

## Decision

- Domain risk profile takes precedence over platform default risk matrix
- Any override must include a documented audit rationale
- High-risk automation is prohibited when no explicit domain risk profile exists

## Consequences

- High-risk domains have clear governance boundaries