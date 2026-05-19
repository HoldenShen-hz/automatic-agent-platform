# DriftAlert Contract

## 1. Scope

This contract defines the drift alert structure and routing rules for `§63`.

## 2. Canonical Objects

- `DriftAlert`
- `DriftAlertRouting`
- `DriftAlertSeverity`

## 3. `DriftAlert` Minimum Fields

- `alert_id`
- `detector_id`
- `drift_type` — input_drift | output_drift | behavioral_drift | quality_drift
- `severity` — SEV2 | SEV3 | SEV4
- `confidence` — confidence (0-1)
- `subject_id` — detected subject ID
- `subject_type` — agent | workflow | task
- `details` — drift details
- `recommended_actions` — recommended actions
- `triggered_at` — trigger time

## 4. `DriftAlertRouting` Rules

| Severity | Route Target | Handling SLA |
|----------|--------------|--------------|
| SEV2 | on-call + automatic response | 5 minutes |
| SEV3 | dashboard + logs | 30 minutes |
| SEV4 | logs only | 24 hours |

## 5. Rules

- Alerts must carry recommended_actions.
- SEV2 and above must trigger an automatic response flow.
- Alert deduplication is based on subject_id + drift_type + time window.

## 6. Test Requirements

- unit: alert generation, deduplication, routing
- integration: alert -> response -> closure
- contract: severity and routing mapping validation
