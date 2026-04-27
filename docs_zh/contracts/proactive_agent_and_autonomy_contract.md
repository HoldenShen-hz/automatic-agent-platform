# Proactive Agent And Autonomy Contract

## 1. 范围

本 contract 定义 `§41-§42` 的主动式触发器、建议管线和渐进式自主权。

## 2. Canonical 对象

- `TriggerDefinition`
- `TriggerEvaluationInput`
- `TriggerFireDecision`
- `ProactiveSuggestion`
- `AutonomyProfile`
- `TrustScore`
- `AutonomyTransitionRecord`

## 3. `TriggerDefinition` 最小字段

- `trigger_id`
- `domain_id`
- `type`: `schedule | event | threshold | webhook_inbound`
- `config`
- `action`
- `risk_level`
- `enabled`
- `max_fire_rate`
- `cooldown`

规则：

- 所有主动行为必须先注册 trigger。
- 未声明 trigger 的主动执行必须被拒绝并审计。

## 4. 自主权等级

`AutonomyProfile.level` 固定为：

- `manual_only`
- `suggest_only`
- `supervised_execute`
- `trusted_auto_execute`

每个等级至少声明：

- `allowed_action_modes`
- `max_risk_level`
- `approval_policy_ref`
- `review_interval`

## 5. 信任积分与变更审计

`TrustScore` 最小字段：

- `subject_id`
- `score`
- `score_band`
- `inputs`
- `updated_at`

`AutonomyTransitionRecord` 最小字段：

- `subject_id`
- `from_level`
- `to_level`
- `reason_codes`
- `evidence_snapshot_ref`
- `actor`
- `occurred_at`

## 6. 运行规则

- trigger 触发不代表可自动执行，最终模式取决于 autonomy level。
- 连续失败、风险升级或人工否决必须支持降级或冻结。
- 主动建议必须可追踪接受率与误报率。

## 7. 测试要求

- unit：trigger evaluation、rate limit、cooldown、autonomy transitions
- integration：trigger -> suggestion / execution
- contract：高风险 trigger 在低 autonomy 等级下必须被阻断



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-25: 自治级别 manual_only/suggest_only/supervised_execute/trusted_auto_execute 与架构§9.5运行时模式无映射，trusted_auto_execute 无对应。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
