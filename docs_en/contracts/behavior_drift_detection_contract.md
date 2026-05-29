# Behavior Drift Detection Contract

## 1. 范围

本 contract defines `§63` 的lines为指纹、变点检测和跨 Agent 异常检测。

## 2. Canonical 对象

- `DriftDetector`
- `DriftAlert`
- `DriftMitigationAction`
- `BehaviorFingerprint`
- `DriftSignal`
- `ChangepointDetectionResult`
- `DriftResponsePlan`

`DriftAlert` / `DriftMitigationAction` 至少需要覆盖以下 drift dimensions：

- `input_drift`
- `output_drift`
- `behavioral_drift`
- `quality_drift`

## 3. `BehaviorFingerprint` 最小字段

- `subject_id`
- `subject_type`
- `window_start`
- `window_end`
- `behavior_features`
- `baseline_ref`

## 4. 规则

- `DriftDetector` 必须同时supported基线指纹比对、统计漂移检测和跨 Agent peer 分析。
- 漂移检测必须区分期望变更vs异常偏移。
- 漂移response必须supported `observe_only | throttle | downgrade | rollback | freeze`。
- response策略必须vs rollout / governance 协同。
- `DriftMitigationAction` 必须显式标注目标对象、来源告警vs过期time，避免告警和occurrences置脱钩。

## 5. 测试要求

- unit：fingerprint build、changepoint detect、response planning
- integration：drift signal -> rollout / autonomy response
- contract：no baseline 的对象不得生成误导性 drift verdict
