# ADR-101: Domain Risk Override Over Platform Default

---

## OAPEFLIR Association

- **Observe**: Platform default risk matrix and domain-specialized risk input
- **Assess**: Determine whether domain override is allowed
- **Plan**: Form domain risk profile
- **Execute**: Apply domain risk priority before task execution
- **Feedback**: Record override reason and audit evidence
- **Learn**: Identify high-risk domain commonalities
- **Improve**: Optimize domain risk baseline
- **Release**: High-risk domain must complete override review before release

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Platform default risk matrix is insufficient to cover high-sensitivity domains such as finance, legal, and medical.

## Decision

- Domain risk profile takes priority over platform default risk matrix
- Any override must leave audit reason
- Without explicit domain risk profile, high-risk automation is prohibited

## Consequences

- High-risk domains have clear governance boundaries