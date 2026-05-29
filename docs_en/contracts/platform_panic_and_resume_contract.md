# Platform Panic And Resume Contract

## 1. 范围

本 contract defines `§60` 的globally熔断、传播机制、恢复协议和演练要求。

## 2. Canonical 对象

- `PlatformPanicDirective`
- `PanicPropagationRecord`
- `ResumePlan`
- `PanicDrillRecord`

## 3. `PlatformPanicDirective` 最小字段

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

`ResumePlan` 最小字段：

- `resume_plan_id`
- `scope`
- `scope_ref`
- `approved_by`
- `approved_roles`
- `approval_count`
- `compatibility_check_ref`
- `resume_mode`
- `created_at`

规则：

- `approved_by` must contain at least two human approvers for `platform` / `region` / high-risk `tenant` panic resume.
- `ResumePlan` must reference an explicit compatibility / revalidation check before execution resumes.
- `workflow` is only a legacy projection scope; new panic directives must scope to `run` or `node`.

## 4. 规则

- panic 必须可作used for `platform / region / tenant / domain / run / node` 多层级。
- panic 生效后，新的高风险执lines必须被阻断。
- 恢复必须via显式 `ResumePlan`，不得靠隐式重启解除。
- 高风险 scope 的 resume 不得由单人、no角色校验或no再验证的计划directly解除。

## 5. 测试要求

- unit：scope match、propagation、resume validation
- integration：panic -> execution block -> resume
- contract：panic 期间不得出现未审计的自动恢复



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-26: 本文原先把 panic scope 停留在 `platform / tenant / org / domain / workflow`，并把 `ResumePlan` 写成nomandatory人工确认的空壳，Root cause: 早期熔断合同从业务工作流视角出发，没有随运lines时 scope 和 emergency governance 机制升级。修复：正文现把 scope 收敛到 `platform / region / tenant / domain / run / node`，并要求 `ResumePlan` 明确双人审批vs兼容性复核references用。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
