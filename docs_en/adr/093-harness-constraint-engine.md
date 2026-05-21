# ADR-093: Harness Constraint Engine

---

## OAPEFLIR Relationship

- **Observe**: Read platform, tenant, domain, task four-layer constraints
- **Assess**: Evaluate budget, risk, and output boundaries
- **Plan**: Merge ConstraintPack and form execution upper limits
- **Execute**: Enforce application before each run
- **Feedback**: Record constraint hits and upgrade reasons
- **Learn**: Accumulate high-frequency constraint conflict patterns
- **Improve**: Iterate risk/output policy
- **Release**: Put constraint engine into release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

If Harness does not have a unified constraint engine, risk, budget, and output governance will be scattered among callers.

## Decision

- Each HarnessRun must carry explicit `ConstraintPack`
- `ConstraintPack` must at minimum contain `risk_policy`, `output_policy`, `budget_envelope`, `sandbox_requirement`, and `approval_requirement`
- Constraint sources merge in order: platform -> tenant -> domain -> task
- When constraints are not satisfied, must fail-close, and write to audit and timeline

## Consequences

- High-risk actions will not bypass Harness constraints
- Runtime and documentation success criteria remain consistent

## v4.3 ADR Remediation

- A-37: This ADR originally reduced `ConstraintPack` to `risk_policy + output_policy`. Root cause was that when the constraint engine ADR was drafted, it only covered risk and output governance, without including budget, sandbox, and approval requirements into the unified constraint pack. Fix: The text now adds `budget_envelope / sandbox_requirement / approval_requirement` to the minimum set.