# Proactive Agent And Autonomy Contract

## 1. 范围

本 contract 定义 `§41-§42` 的主动式触发器、建议管线和渐进式自主权。

## 2. Canonical 对象

- `TriggerDefinition`
- `TriggerEvaluationInput`
- `TriggerFireDecision`
- `ProactiveSuggestion`
- `AutonomyProfile`
- `RuntimeModeEnvelope`
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

## 4. 运行模式与自主权边界

`RuntimeModeEnvelope.mode` canonical enum:

- `full_auto`
- `supervised_auto`
- `read_only`
- `no-write`
- `no-external-call`
- `no-rollout`
- `manual_only`
- `incident-mode`

`AutonomyProfile` 最少字段：

- `profile_id`
- `domain_id`
- `runtime_mode`
- `allowed_action_modes`
- `max_risk_level`
- `approval_policy_ref`
- `review_interval`
- `degrade_path`
- `freeze_conditions`

规则：

- 自主权 contract 必须直接引用 canonical `runtime_mode`，不得再以 `trusted_auto_execute` 等独立枚举替代。
- `manual_only`、`read_only`、`no-write`、`no-external-call`、`no-rollout`、`incident-mode` 都是可触发的真实治理模式，不是描述性标签。
- 若产品或 UI 仍需展示 `suggest_only / supervised_execute` 一类叙事级别，只能作为 view 映射，不得作为运行时 truth。

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

- trigger 触发不代表可自动执行，最终模式取决于 `AutonomyProfile.runtime_mode`。
- 连续失败、风险升级或人工否决必须支持降级或冻结。
- 主动建议必须可追踪接受率与误报率。

补充规则：

- 高风险域默认不得进入 `full_auto`；至少应从 `supervised_auto` 或更保守模式起步。
- 降级必须沿 `degrade_path` 单调收紧，例如 `full_auto -> supervised_auto -> no-write -> manual_only -> incident-mode`。
- 自主触发器若命中 `no-rollout` 或 `manual_only`，只能形成 `ProactiveSuggestion`，不得直接下发执行。

## 7. 测试要求

- unit：trigger evaluation、rate limit、cooldown、autonomy transitions
- integration：trigger -> suggestion / execution
- contract：高风险 trigger 在低 autonomy 等级下必须被阻断



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-25: 本文原先使用 `manual_only / suggest_only / supervised_execute / trusted_auto_execute` 四级自主权梯子，根因是早期产品设计想表达用户感知的自动化强弱，却没有与控制平面的规范运行模式做一一绑定。修复：正文现把自主权边界直接收敛到 `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode` 八种 canonical runtime mode。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
