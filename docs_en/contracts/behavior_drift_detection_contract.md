# Behavior Drift Detection Contract

## 1. Scope

This contract defines `§63`'s behavior fingerprints, change point detection, and cross-Agent anomaly detection.

## 2. Canonical Objects

- `BehaviorFingerprint`
- `DriftSignal`
- `ChangepointDetectionResult`
- `DriftResponsePlan`

## 3. BehaviorFingerprint Minimum Fields

- `subject_id`
- `subject_type`
- `window_start`
- `window_end`
- `behavior_features`
- `baseline_ref`

## 4. Rules

- Drift detection must distinguish expected changes from anomalous deviations.
- Drift response must support `observe_only | throttle | downgrade | rollback | freeze`.
- Response strategies must coordinate with rollout / governance.

## 5. Testing Requirements

- unit: fingerprint build, changepoint detect, response planning
- integration: drift signal -> rollout / autonomy response
- contract: objects without baseline must not generate misleading drift verdicts
