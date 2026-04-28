# ADR-101 Domain Risk Override Over Platform Default

---

## OAPEFLIR Association

- **Observe**: Platform default risk matrix and domain-specific risk input
- **Assess**: Determine whether domain override is allowed
- **Plan**: Form domain risk profile
- **Execute**: Apply domain risk priority before task execution
- **Feedback**: Record override justification and audit evidence
- **Learn**: Identify high-risk domain commonalities
- **Improve**: Optimize domain risk baseline
- **Release**: High-risk domains must complete override review before going live

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

The platform default risk matrix is insufficient to cover high-sensitivity domains such as finance, legal, and healthcare.

## Decision

- Domain risk profile takes priority over platform default risk matrix
- Any override must leave an audit justification
- Without an explicit domain risk profile, high-risk automation is prohibited

## Consequences

- High-risk domains have clear governance boundaries
