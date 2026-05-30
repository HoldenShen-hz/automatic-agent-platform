# DriftMitigationAction Contract

## 1. Scope

This contract defines drift mitigation measures and execution specifications for `§63`.

## 2. Canonical Objects

- `DriftMitigationAction`
- `MitigationResult`
- `MitigationPolicy`

## 3. `DriftMitigationAction` Minimum Fields

- `action_id`
- `alert_id` — associated DriftAlert
- `action_type` — observe_only | throttle | downgrade | rollback | freeze
- `target_subject_id` — acting target
- `target_subject_type` — agent | workflow | task
- `parameters` — action parameters
- `status` — proposed | approved | executing | completed | failed
- `executed_by` — executor
- `executed_at` — execution timestamp

## 4. `MitigationPolicy` Rules

| Drift Type | Default Response |
|----------|----------|
| input_drift | observe_only (24h) |
| output_drift | throttle |
| behavioral_drift | downgrade |
| quality_drift | rollback |

## 5. Rules

- MitigationAction must be associated with DriftAlert
- action_type must comply with MitigationPolicy
- Execution status must be tracked: proposed -> approved -> executing -> completed/failed
- Rollback operations must preserve rollback points

## 6. Test Requirements

- unit: execution of various mitigation actions
- integration: drift detection -> mitigation -> effect validation
- contract: action state machine integrity validation