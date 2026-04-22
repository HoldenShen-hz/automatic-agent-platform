# ADR-101 Domain Risk Override Over Platform Default

---

## OAPEFLIR Association

- **Observe**: Read the platform default risk matrix and domain-specific risk inputs
- **Assess**: Decide whether domain override is required
- **Plan**: Build the effective domain risk profile
- **Execute**: Apply domain risk before task execution
- **Feedback**: Record override reason and audit evidence
- **Learn**: Identify recurring high-risk domain patterns
- **Improve**: Refine domain risk baselines
- **Release**: High-risk domains require reviewed overrides

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Platform defaults are insufficient for domains such as finance, legal, and healthcare.

## Decision

- Domain risk profile overrides the platform default matrix
- Any override must carry an auditable reason

## Consequences

- High-risk domains gain explicit governance boundaries
