# DriftAlert Contract

## 1. Scope

This contract defines drift alert structure and routing specifications for `§63`.

## 2. Canonical Objects

- `DriftAlert`
- `DriftAlertRouting`
- `DriftAlertSeverity`

## 3. `DriftAlert` Minimum Fields

- `alert_id`
- `detector_id`
- `drift_type` — input_drift | output_drift | behavioral_drift | quality_drift
- `severity` — SEV2 | SEV3 | SEV4
- `confidence` — confidence level (0-1)
- `subject_id` — ID of the detected object
- `subject_type` — agent | workflow | task
- `details` — drift details
- `recommended_actions` — list of recommended actions
- `triggered_at` — trigger timestamp

## 4. `DriftAlertRouting` Rules

| Severity | Routing Target | Handling Time Limit |
|----------|----------|----------|
| SEV2 | on-call + automatic response | 5 minutes |
| SEV3 | dashboard + logs | 30 minutes |
| SEV4 | log recording | 24 hours |

## 5. Rules

- Alerts must carry recommended_actions
- SEV2 and above must trigger automatic response flow
- Alert deduplication is based on subject_id + drift_type + time window

## 6. Test Requirements

- unit: alert generation, deduplication, routing
- integration: alert -> response -> closure
- contract: severity vs. routing mapping validation