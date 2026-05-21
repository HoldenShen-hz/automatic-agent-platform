# Behavior Drift Detection Contract

## 1. Scope

This contract defines behavioral fingerprints, changepoint detection, and cross-Agent anomaly detection for `§63`.

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

- `DriftDetector` must support baseline fingerprint comparison, statistical drift detection, and cross-Agent peer analysis simultaneously.
- Drift detection must distinguish between expected changes and anomalous deviations.
- Drift response must support `observe_only | throttle | downgrade | rollback | freeze`.
- Response strategies must coordinate with rollout / governance.
- `DriftMitigationAction` must explicitly label the target object, source alert, and expiration time to avoid decoupling between alerts and mitigation.

## 5. Testing Requirements

- unit: fingerprint build, changepoint detect, response planning
- integration: drift signal -> rollout / autonomy response
- contract: objects without a baseline must not generate misleading drift verdicts