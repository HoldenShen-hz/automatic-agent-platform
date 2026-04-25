# ADR-093 Harness Constraint Engine

---

## OAPEFLIR Association

- **Observe**: Read platform, tenant, domain, and task constraints
- **Assess**: Evaluate budget, risk, and output boundaries
- **Plan**: Merge the effective ConstraintPack
- **Execute**: Apply constraints before each run
- **Feedback**: Record matched constraints and escalation reasons
- **Learn**: Capture recurring constraint conflicts
- **Improve**: Evolve risk and output policy
- **Release**: Make the constraint engine part of release gates

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Without a unified constraint engine, risk, budget, and output policy drift into calling code.

## Decision

- Every HarnessRun carries an explicit `ConstraintPack`
- `ConstraintPack` must include `risk_policy` and `output_policy`
- Constraints are merged in platform -> tenant -> domain -> task order
- When constraints are not satisfied, fail-close and write to audit and timeline

## Consequences

- High-risk actions cannot bypass Harness constraints
- Runtime behavior aligns with documented success criteria