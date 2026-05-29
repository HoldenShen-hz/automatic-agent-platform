# DriftMitigationAction Contract

## 1. 范围

本 contract defines `§63` 的漂移缓解措施和执lines规范。

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
- `parameters` — lines动参数
- `status` — proposed | approved | executing | completed | failed
- `executed_by` — 执lines者
- `executed_at` — 执linestime

## 4. `MitigationPolicy` 规则

| 漂移class型 | defaults toresponse |
|----------|----------|
| input_drift | observe_only (24h) |
| output_drift | throttle |
| behavioral_drift | downgrade |
| quality_drift | rollback |

## 5. 规则

- MitigationAction 必须关联 DriftAlert
- action_type 必须符合 MitigationPolicy
- 执linesStatus必须追踪：proposed -> approved -> executing -> completed/failed
- rollback 操作必须保留回滚点

## 6. 测试要求

- unit：各class缓解 action 执lines
- integration：drift detection -> mitigation -> 效果验证
- contract：action Status机完整性校验
