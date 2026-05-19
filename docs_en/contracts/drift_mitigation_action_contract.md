# DriftMitigationAction Contract

## 1. Scope

This contract defines drift mitigation actions and execution rules for `§63`.

## 2. Canonical Objects

- `DriftMitigationAction`
- `MitigationResult`
- `MitigationPolicy`

## 3. `DriftMitigationAction` Minimum Fields

- `action_id`
- `alert_id` — associated DriftAlert
- `action_type` — observe_only | throttle | downgrade | rollback | freeze
- `target_subject_id` — target subject
- `target_subject_type` — agent | workflow | task
- `parameters` — action parameters
- `status` — proposed | approved | executing | completed | failed
- `executed_by` — executor
- `executed_at` — execution time

## 4. `MitigationPolicy` Rules

| Drift Type | Default Response |
|------------|------------------|
| input_drift | observe_only (24h) |
| output_drift | throttle |
| behavioral_drift | downgrade |
| quality_drift | rollback |

## 5. Rules

- MitigationAction must be associated with a DriftAlert.
- action_type must comply with MitigationPolicy.
- Execution status must track: proposed -> approved -> executing -> completed/failed.
- rollback operations must preserve rollback points.

## 6. Test Requirements

- unit: execution of each mitigation action type
- integration: drift detection -> mitigation -> effect validation
- contract: action state-machine integrity validation
