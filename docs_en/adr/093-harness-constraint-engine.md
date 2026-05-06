# ADR-093 Harness Constraint Engine

---

## OAPEFLIR Association

- **Observe**: Read platform, tenant, domain, and task four-layer constraints
- **Assess**: Evaluate budget, risk, and output boundaries
- **Plan**: Merge ConstraintPack and form execution caps
- **Execute**: Force application before each run
- **Feedback**: Record constraint hits and escalation reasons
- **Learn**: Accumulate high-frequency constraint conflict patterns
- **Improve**: Iterate risk/output policy
- **Release**: Incorporate constraint engine into release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

If Harness lacks a unified constraint engine, risk, budget, and output governance will be scattered at the caller.

## Decision

- Each HarnessRun must carry an explicit `ConstraintPack`
- `ConstraintPack` must contain at least `risk_policy`, `output_policy`, `budget_envelope`, `sandbox_requirement`, and `approval_requirement`
- Constraint sources merge by platform -> tenant -> domain -> task
- Must fail-close when constraints are not met, and write to audit and timeline

## Consequences

- High-risk actions cannot bypass Harness constraints
- Runtime remains consistent with success criteria in documentation

## v4.3 ADR Remediation

- A-37: This ADR originally reduced `ConstraintPack` to `risk_policy + output_policy`, because when the constraint engine ADR was drafted, it only covered risk and output governance, and did not include budget, sandbox, and approval requirements in the unified constraint package. Fix: The main text now adds `budget_envelope / sandbox_requirement / approval_requirement` to the minimum set.
