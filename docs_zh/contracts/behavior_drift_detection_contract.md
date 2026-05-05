# Behavior Drift Detection Contract

## 1. 范围

本 contract 定义 `§63` 的行为指纹、变点检测和跨 Agent 异常检测。

## 2. Canonical 对象

- `BehaviorFingerprint`
- `DriftSignal`
- `ChangepointDetectionResult`
- `DriftResponsePlan`

## 3. `BehaviorFingerprint` 最小字段

- `subject_id`
- `subject_type`
- `window_start`
- `window_end`
- `behavior_features`
- `baseline_ref`

## 4. 规则

- 漂移检测必须区分期望变更与异常偏移。
- 漂移响应必须支持 `observe_only | throttle | downgrade | rollback | freeze`。
- 响应策略必须与 release / governance 协同。

## 5. 测试要求

- unit：fingerprint build、changepoint detect、response planning
- integration：drift signal -> release / autonomy response
- contract：无 baseline 的对象不得生成误导性 drift verdict

