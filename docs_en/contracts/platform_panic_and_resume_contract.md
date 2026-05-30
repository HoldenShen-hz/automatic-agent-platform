# Platform Panic And Resume Contract

## 1. Scope

This contract defines the global circuit breaker, propagation mechanism, recovery protocol, and drill requirements for §60.

## 2. Canonical Objects

- `PlatformPanicDirective`
- `PanicPropagationRecord`
- `ResumePlan`
- `PanicDrillRecord`

## 3. `PlatformPanicDirective` Minimal Fields

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

`ResumePlan` minimal fields:

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

- Panic must be applicable to multi-levels: `platform / region / tenant / domain / run / node`.
- After panic takes effect, new high-risk executions must be blocked.
- Recovery must go through explicit `ResumePlan`; must not be lifted by implicit restart.
- High-risk scope resume must not be lifted by single-person, no-role-verification, or no-revalidation plans.

## 5. Test Requirements

- unit: scope match, propagation, resume validation
- integration: panic -> execution block -> resume
- contract: No unaudited automatic recovery during panic period



## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-26: The original text kept panic scope at `platform / tenant / org / domain / workflow` and wrote `ResumePlan` as a shell without mandatory human confirmation. Root cause: Early circuit breaker contracts were viewed from business workflow perspective and did not upgrade with runtime scope and emergency governance mechanisms. Fix: The main text now converges scope to `platform / region / tenant / domain / run / node` and requires `ResumePlan` to explicitly specify dual-person approval and compatibility review references.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only act as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.