# DriftAlert Contract

## 1. 范围

本 contract 定义 `§63` 的漂移告警结构和路由规范。

## 2. Canonical 对象

- `DriftAlert`
- `DriftAlertRouting`
- `DriftAlertSeverity`

## 3. `DriftAlert` 最小字段

- `alert_id`
- `detector_id`
- `drift_type` — input_drift | output_drift | behavioral_drift | quality_drift
- `severity` — SEV2 | SEV3 | SEV4
- `confidence` — 置信度 (0-1)
- `subject_id` — 被检测对象 ID
- `subject_type` — agent | workflow | task
- `details` — 漂移详情
- `recommended_actions` — 建议操作列表
- `triggered_at` — 触发时间

## 4. `DriftAlertRouting` 规则

| Severity | 路由目标 | 处理时限 |
|----------|----------|----------|
| SEV2 | on-call + 自动响应 | 5 分钟 |
| SEV3 | dashboard + 日志 | 30 分钟 |
| SEV4 | 日志记录 | 24 小时 |

## 5. 规则

- Alert 必须携带 recommended_actions
- SEV2 及以上必须触发自动响应流程
- Alert 去重基于 subject_id + drift_type + 时间窗口

## 6. 测试要求

- unit：告警生成、去重、路由
- integration：告警 -> 响应 -> 闭环
- contract：severity 与 routing 映射校验
