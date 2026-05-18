# Platform Panic And Resume Contract

## 1. Scope

This contract defines global circuit breaking, propagation mechanism, recovery protocol, and drill requirements as specified in `§60`.

## 2. Canonical Objects

- `PlatformPanicDirective`
- `PanicPropagationRecord`
- `ResumePlan`
- `PanicDrillRecord`

## 3. `PlatformPanicDirective` Minimum Fields

- `directive_id`
- `scope`
- `scope_ref`
- `reason_code`
- `issued_by`
- `issued_at`
- `freeze_modes`
- `allow_list?`
- `expires_at`

`scope` canonical enum:

- `platform`
- `region`
- `tenant`
- `domain`
- `run`
- `node`

`ResumePlan` minimum fields:

- `resume_plan_id`
- `scope`
- `scope_ref`
- `approved_by`
- `approved_roles`
- `approval_count`
- `compatibility_check_ref`
- `resume_mode`
- `created_at`

Rules:

- `approved_by` must contain at least two human approvers for `platform` / `region` / high-risk `tenant` panic resume.
- `ResumePlan` must reference an explicit compatibility / revalidation check before execution resumes.
- `workflow` is only a legacy projection scope; new panic directives must scope to `run` or `node`.

## 4. Rules

- Panic must be applicable at multiple levels: `platform / region / tenant / domain / run / node`.
- After panic takes effect, new high-risk execution must be blocked.
- Resume must go through explicit `ResumePlan` and must not be lifted by implicit restart.
- High-risk scope resume must not be lifted by a single person, without role verification, or without a revalidation plan.

## 5. Test Requirements

- unit: scope match, propagation, resume validation
- integration: panic -> execution block -> resume
- contract: no unaudited automatic recovery during panic


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-26: This document originally kept panic scope at `platform / tenant / org / domain / workflow` and wrote `ResumePlan` as an empty shell without mandatory human confirmation. Root cause: early circuit-breaking contract was from a business workflow perspective and did not upgrade along with runtime scope and emergency governance mechanisms. Fix: The body now converges scope to `platform / region / tenant / domain / run / node` and requires `ResumePlan` to explicitly reference two-person approval and compatibility review.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plan must use `PlanGraphBundle`; execution result must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only be `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.