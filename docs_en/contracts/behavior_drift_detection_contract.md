# Behavior Drift Detection Contract

## 1. Scope

This contract defines `§63`'s behavior fingerprints, change point detection, and cross-Agent anomaly detection.

## 2. Canonical Objects

- `DriftDetector`
- `DriftAlert`
- `DriftMitigationAction`
- `BehaviorFingerprint`
- `DriftSignal`
- `ChangepointDetectionResult`
- `DriftResponsePlan`

`DriftAlert` / `DriftMitigationAction` must cover at least the following drift dimensions:

- `input_drift`
- `output_drift`
- `behavioral_drift`
- `quality_drift`

## 3. `BehaviorFingerprint` Minimum Fields

- `subject_id`
- `subject_type`
- `window_start`
- `window_end`
- `behavior_features`
- `baseline_ref`

## 4. Rules

- `DriftDetector` must simultaneously support baseline fingerprint comparison, statistical drift detection, and cross-Agent peer analysis.
- Drift detection must distinguish expected changes from anomalous deviations.
- Drift response must support `observe_only | throttle | downgrade | rollback | freeze`.
- Response strategy must coordinate with rollout / governance.
- `DriftMitigationAction` must explicitly label target object, source alert, and expiration time to avoid decoupling of alerts and actions.

## 5. Testing Requirements

- unit: fingerprint build, changepoint detect, response planning
- integration: drift signal -> rollout / autonomy response
- contract: objects without baseline must not generate misleading drift verdict