# DriftMitigationAction Contract

## 1. 范围

本 contract 定义 `§63` 的漂移缓解措施和执行规范。

## 2. Canonical 对象

- `DriftMitigationAction`
- `MitigationResult`
- `MitigationPolicy`

## 3. `DriftMitigationAction` 最小字段

- `action_id`
- `alert_id` — 关联的 DriftAlert
- `action_type` — observe_only | throttle | downgrade | rollback | freeze
- `target_subject_id` — 施动对象
- `target_subject_type` — agent | workflow | task
- `parameters` — 行动参数
- `status` — proposed | approved | executing | completed | failed
- `executed_by` — 执行者
- `executed_at` — 执行时间

## 4. `MitigationPolicy` 规则

| 漂移类型 | 默认响应 |
|----------|----------|
| input_drift | observe_only (24h) |
| output_drift | throttle |
| behavioral_drift | downgrade |
| quality_drift | rollback |

## 5. 规则

- MitigationAction 必须关联 DriftAlert
- action_type 必须符合 MitigationPolicy
- 执行状态必须追踪：proposed -> approved -> executing -> completed/failed
- rollback 操作必须保留回滚点

## 6. 测试要求

- unit：各类缓解 action 执行
- integration：drift detection -> mitigation -> 效果验证
- contract：action 状态机完整性校验
