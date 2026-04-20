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

