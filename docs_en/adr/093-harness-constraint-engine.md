# ADR-093 Harness Constraint Engine

---

## OAPEFLIR Association

- **Observe**: Read platform, tenant, domain, task four-layer constraints
- **Assess**: Evaluate budget, risk, and output boundary
- **Plan**: Merge ConstraintPack and form execution upper limit
- **Execute**: Mandatory apply before each round of execution
- **Feedback**: Record constraint hits and escalation reasons
- **Learn**:沉淀 high-frequency constraint conflict patterns
- **Improve**: Iterate risk/output policy
- **Release**: Include constraint engine in release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

If Harness lacks a unified constraint engine, risk, budget, output governance will scatter across callers.

## Decision

- Each HarnessRun must carry explicit `ConstraintPack`
- `ConstraintPack` must contain at minimum `risk_policy`, `output_policy`, `budget_envelope`, `sandbox_requirement`, and `approval_requirement`
- Constraint sources merge in order: platform -> tenant -> domain -> task
- When constraints are not satisfied, must fail-close and write audit and timeline

## Consequences

- High-risk actions will not bypass Harness constraints
- Runtime and success criteria in documentation remain consistent

## v4.3 ADR Remediation

- A-37: This ADR originally缩减 `ConstraintPack` to `risk_policy + output_policy`. Root cause: Constraint engine ADR draft only covered risk and output governance, did not include budget, sandbox, and approval requirements in unified constraint pack. Fix: Body now adds `budget_envelope / sandbox_requirement / approval_requirement` to the minimum set.