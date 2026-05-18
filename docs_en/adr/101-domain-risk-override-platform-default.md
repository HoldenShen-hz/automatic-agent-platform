# ADR-101 Domain Risk Override Over Platform Default

---

## OAPEFLIR Association

- **Observe**: Platform default risk matrix and domain-specialized risk input
- **Assess**: Determine if domain override is allowed
- **Plan**: Form domain risk profile
- **Execute**: Apply domain risk priority before task execution
- **Feedback**: Record override reasons and audit evidence
- **Learn**: Identify high-risk domain commonalities
- **Improve**: Optimize domain risk baseline
- **Release**: High-risk domains must complete override review before release

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Platform default risk matrix is insufficient to cover high-sensitivity domains such as finance, legal, and medical.

## Decision

- Domain risk profile takes precedence over platform default risk matrix
- Any override must leave an audit reason
- Without explicit domain risk profile, high-risk automation is prohibited

## Consequences

- High-risk domains have clear governance boundaries
