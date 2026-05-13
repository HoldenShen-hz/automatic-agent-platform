# Platform Panic And Resume Contract

## 1. Scope

This contract defines global circuit breaking, propagation mechanisms, recovery protocols, and drill requirements for `§60`.

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
- After panic takes effect, new high-risk executions must be blocked.
- Recovery must go through an explicit `ResumePlan`; implicit restart must not be used to clear the state.
- Resume for high-risk scopes must not be cleared by a plan with single person, no role verification, or no revalidation.

## 5. Test Requirements

- unit: scope match, propagation, resume validation
- integration: panic -> execution block -> resume
- contract: no unaudited automatic recovery during panic period



## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-26: This document previously limited panic scope to `platform / tenant / org / domain / workflow` and described `ResumePlan` as a shell with no mandatory human confirmation. Root cause: early circuit-breaking contracts were viewed from a business workflow perspective and did not evolve along with runtime scope and emergency governance mechanisms. Fix: the main text now converges scope to `platform / region / tenant / domain / run / node`, and requires `ResumePlan` to explicitly reference dual-person approval and compatibility review.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.