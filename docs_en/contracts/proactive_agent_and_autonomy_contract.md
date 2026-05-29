# Proactive Agent And Autonomy Contract

## 1. 范围

本 contract defines `§41-§42` 的主动式触发器、Recommendation管线和渐进式自主权。

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

- 所有主动lines为必须先注册 trigger。
- 未声明 trigger 的主动执lines必须被拒绝并审计。

## 4. 运lines模式vs自主权边界

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

- 自主权 contract 必须directlyreferences用 canonical `runtime_mode`，不得再以 `trusted_auto_execute` 等独立枚举替代。
- `manual_only`、`read_only`、`no-write`、`no-external-call`、`no-rollout`、`incident-mode` 都is可触发的真实治理模式，不isDescription性标签。
- 若产品或 UI 仍需展示 `suggest_only / supervised_execute` 一class叙事级别，只能作为 view 映射，不得作为运lines时 truth。

## 5. 信任积分vs变更审计

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

## 6. 运lines规则

- trigger 触发不代table可自动执lines，最终模式取决于 `AutonomyProfile.runtime_mode`。
- 连续failed、风险升级或人工no决必须supported降级或冻结。
- 主动Recommendation必须可追踪accepts率vs误报率。

补充规则：

- 高风险域defaults to不得进入 `full_auto`；至少应从 `supervised_auto` 或更保守模式起步。
- 降级必须accesses along `degrade_path` 单调收紧，例如 `full_auto -> supervised_auto -> no-write -> manual_only -> incident-mode`。
- 自主触发器若命中 `no-rollout` 或 `manual_only`，只能形成 `ProactiveSuggestion`，不得directly下发执lines。

## 7. 测试要求

- unit：trigger evaluation、rate limit、cooldown、autonomy transitions
- integration：trigger -> suggestion / execution
- contract：高风险 trigger 在低 autonomy 等级下必须被阻断



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-25: 本文原先uses `manual_only / suggest_only / supervised_execute / trusted_auto_execute` 四级自主权梯子，Root cause: 早期产品设计想table达user感知的自动化强弱，却没有vs控制平面的规范运lines模式做一一绑定。修复：正文现把自主权边界directly收敛到 `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode` 八种 canonical runtime mode。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
