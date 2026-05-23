# ADR-093 Harness Constraint Engine

---

## OAPEFLIR Association

- **Observe**: Read platform, tenant, domain, task four-layer constraints
- **Assess**: Evaluate budget, risk, and output boundaries
- **Plan**: Merge ConstraintPack and form execution ceiling
- **Execute**: Force apply before each round of execution
- **Feedback**: Record constraint hits and escalation reasons
- **Learn**: Accumulate high-frequency constraint conflict patterns
- **Improve**: Iterate risk/output policy
- **Release**: Include constraint engine in release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

If Harness does not have a unified constraint engine, risk, budget, and output governance will be scattered among callers.

## Decision

- Each HarnessRun must carry explicit `ConstraintPack`
- `ConstraintPack` at minimum contains `risk_policy`, `output_policy`, `budget_envelope`, `sandbox_requirement`, and `approval_requirement`
- Constraint sources merge by platform -> tenant -> domain -> task
- When constraints are not met, must fail-close, and write audit and timeline

## Consequences

- High-risk actions will not bypass Harness constraints
- Runtime and documentation success criteria remain consistent

## v4.3 ADR Remediation

- A-37: This ADR originally reduced `ConstraintPack` to `risk_policy + output_policy`,根因 was that constraint engine ADR was drafted covering only risk and output governance, and did not include budget, sandbox, and approval requirements into unified constraint pack. Fix: The text now adds `budget_envelope / sandbox_requirement / approval_requirement` to the minimum set.
