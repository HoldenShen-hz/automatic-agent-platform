# DriftAlert Contract

## 1. Scope

This contract defines the drift alert structure and routing specification for `§63`.

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
- `subject_id` — subject ID being detected
- `subject_type` — agent | workflow | task
- `details` — drift details
- `recommended_actions` — recommended action list
- `triggered_at` — trigger timestamp

## 4. `DriftAlertRouting` Rules

| Severity | Routing Target | Processing Time Limit |
|----------|----------------|-----------------------|
| SEV2 | on-call + auto response | 5 minutes |
| SEV3 | dashboard + log | 30 minutes |
| SEV4 | log only | 24 hours |

## 5. Rules

- Alert must carry recommended_actions
- SEV2 and above must trigger auto response flow
- Alert deduplication based on subject_id + drift_type + time window

## 6. Test Requirements

- unit: alert generation, deduplication, routing
- integration: alert -> response -> closure
- contract: severity and routing mapping validation
