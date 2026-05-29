# DriftAlert Contract

## 1. 范围

本 contract defines `§63` 的漂移告警结构和路由规范。

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
- `recommended_actions` — Recommendation操作列table
- `triggered_at` — 触发time

## 4. `DriftAlertRouting` 规则

| Severity | 路由目标 | handle时限 |
|----------|----------|----------|
| SEV2 | on-call + 自动response | 5 分钟 |
| SEV3 | dashboard + 日志 | 30 分钟 |
| SEV4 | 日志record | 24 小时 |

## 5. 规则

- Alert 必须携带 recommended_actions
- SEV2 及以上必须触发自动response流程
- Alert for deduplicationbased on subject_id + drift_type + time窗口

## 6. 测试要求

- unit：告警生成、for deduplication、路由
- integration：告警 -> response -> 闭环
- contract：severity vs routing 映射校验
