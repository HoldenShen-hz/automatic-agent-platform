# Proactive Agent And Autonomy Contract

## 1. Scope

This contract defines proactive triggers, suggestion pipelines, and gradual autonomy for `§41-§42`.

## 2. Canonical Objects

- `TriggerDefinition`
- `TriggerEvaluationInput`
- `TriggerFireDecision`
- `ProactiveSuggestion`
- `AutonomyProfile`
- `TrustScore`
- `AutonomyTransitionRecord`

## 3. `TriggerDefinition` Minimum Fields

- `trigger_id`
- `domain_id`
- `type`: `schedule | event | threshold | webhook_inbound`
- `config`
- `action`
- `risk_level`
- `enabled`
- `max_fire_rate`
- `cooldown`

Rules:

- All proactive behavior must first register a trigger.
- Undeclared trigger-based proactive execution must be rejected and audited.

## 4. Autonomy Levels

`AutonomyProfile.level` is fixed to:

- `manual_only`
- `suggest_only`
- `supervised_execute`
- `trusted_auto_execute`

Each level must declare at minimum:

- `allowed_action_modes`
- `max_risk_level`
- `approval_policy_ref`
- `review_interval`

## 5. Trust Score and Change Audit

`TrustScore` Minimum Fields:

- `subject_id`
- `score`
- `score_band`
- `inputs`
- `updated_at`

`AutonomyTransitionRecord` Minimum Fields:

- `subject_id`
- `from_level`
- `to_level`
- `reason_codes`
- `evidence_snapshot_ref`
- `actor`
- `occurred_at`

## 6. Operating Rules

- Trigger firing does not guarantee automatic execution; final mode depends on autonomy level.
- Continuous failures, risk escalation, or human veto must support demotion or freezing.
- Proactive suggestions must be trackable for acceptance rate and false positive rate.

## 7. Test Requirements

- unit: trigger evaluation, rate limit, cooldown, autonomy transitions
- integration: trigger -> suggestion / execution
- contract: high-risk triggers must be blocked at low autonomy levels
