# Behavior Drift Detection Contract

## 1. Scope

This contract defines behavior fingerprint, changepoint detection, and cross-agent anomaly detection for `§63`.

## 2. Canonical Objects

- `BehaviorFingerprint`
- `DriftSignal`
- `ChangepointDetectionResult`
- `DriftResponsePlan`

## 3. `BehaviorFingerprint` Minimum Fields

- `subject_id`
- `subject_type`
- `window_start`
- `window_end`
- `behavior_features`
- `baseline_ref`

## 4. Rules

- Drift detection must distinguish expected changes from anomalous deviations.
- Drift response must support `observe_only | throttle | downgrade | rollback | freeze`.
- Response strategy must coordinate with rollout / governance.

## 5. Test Requirements

- unit: fingerprint build, changepoint detect, response planning
- integration: drift signal -> rollout / autonomy response
- contract: objects without baseline must not generate misleading drift verdict