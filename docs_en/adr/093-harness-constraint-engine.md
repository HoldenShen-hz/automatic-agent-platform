# ADR-093 Harness Constraint Engine

---

## OAPEFLIR Association

- **Observe**: Read platform, tenant, domain, task four-layer constraints
- **Assess**: Evaluate budget, risk, and output boundaries
- **Plan**: Merge ConstraintPack and form execution upper limit
- **Execute**: Enforce apply before each round of execution
- **Feedback**: Record constraint hits and escalation reasons
- **Learn**: Accumulate high-frequency constraint conflict patterns
- **Improve**: Iterate risk/output policy
- **Release**: Incorporate constraint engine into release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

If Harness does not have a unified constraint engine, risk, budget, and output governance will be scattered across callers.

## Decisions

- Each HarnessRun must carry an explicit `ConstraintPack`
- `ConstraintPack` must contain at minimum `risk_policy`, `output_policy`, `budget_envelope`, `sandbox_requirement`, and `approval_requirement`
- Constraints are merged in order: platform -> tenant -> domain -> task
- When constraints are not satisfied, it must fail-close and write to audit and timeline

## Consequences

- High-risk actions cannot bypass Harness constraints
- Runtime and success criteria in documentation remain consistent

## v4.3 ADR Remediation

- A-37: This ADR originally reduced `ConstraintPack` to `risk_policy + output_policy`; the root cause is that when the constraint engine ADR was drafted, it only covered risk and output governance, and did not incorporate budget, sandbox, and approval requirements into the unified constraint pack. Fix: The main text now adds `budget_envelope / sandbox_requirement / approval_requirement` to the minimum set.
