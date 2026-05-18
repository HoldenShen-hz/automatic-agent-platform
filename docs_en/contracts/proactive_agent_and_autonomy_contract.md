# Proactive Agent And Autonomy Contract

## 1. Scope

This contract defines the proactive triggers, suggestion pipeline, and progressive autonomy boundaries as specified in `§41-§42`.

## 2. Canonical Objects

- `TriggerDefinition`
- `TriggerEvaluationInput`
- `TriggerFireDecision`
- `ProactiveSuggestion`
- `AutonomyProfile`
- `RuntimeModeEnvelope`
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

- All proactive behaviors must register trigger first.
- Proactive execution without declared trigger must be rejected and audited.

## 4. Runtime Mode And Autonomy Boundaries

`RuntimeModeEnvelope.mode` canonical enum:

- `full_auto`
- `supervised_auto`
- `read_only`
- `no-write`
- `no-external-call`
- `no-rollout`
- `manual_only`
- `incident-mode`

`AutonomyProfile` minimum fields:

- `profile_id`
- `domain_id`
- `runtime_mode`
- `allowed_action_modes`
- `max_risk_level`
- `approval_policy_ref`
- `review_interval`
- `degrade_path`
- `freeze_conditions`

Rules:

- Autonomy contract must directly reference canonical `runtime_mode` and must not use independent enums like `trusted_auto_execute`.
- `manual_only`, `read_only`, `no-write`, `no-external-call`, `no-rollout`, `incident-mode` are all triggerable real governance modes, not descriptive labels.
- If product or UI still needs to display narrative-level like `suggest_only / supervised_execute`, they may only serve as view mapping and must not be used as runtime truth.

## 5. Trust Score And Change Audit

`TrustScore` minimum fields:

- `subject_id`
- `score`
- `score_band`
- `inputs`
- `updated_at`

`AutonomyTransitionRecord` minimum fields:

- `subject_id`
- `from_level`
- `to_level`
- `reason_codes`
- `evidence_snapshot_ref`
- `actor`
- `occurred_at`

## 6. Runtime Rules

- Trigger firing does not mean automatic execution; final mode depends on `AutonomyProfile.runtime_mode`.
- Continuous failures, risk escalation, or human veto must support degrade or freeze.
- Proactive suggestions must be trackable for acceptance rate and false positive rate.

Supplementary rules:

- High-risk domains default to not enter `full_auto`; should start from `supervised_auto` or more conservative modes.
- Degrade must monotonically tighten along `degrade_path`, e.g., `full_auto -> supervised_auto -> no-write -> manual_only -> incident-mode`.
- If proactive trigger hits `no-rollout` or `manual_only`, may only form `ProactiveSuggestion` and must not directly dispatch execution.

## 7. Test Requirements

- unit: trigger evaluation, rate limit, cooldown, autonomy transitions
- integration: trigger -> suggestion / execution
- contract: high-risk trigger must be blocked under low autonomy level


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-25: This document originally used `manual_only / suggest_only / supervised_execute / trusted_auto_execute` four-level autonomy ladder. Root cause: early product design wanted to express user-perceived automation strength but did not bind one-to-one with canonical runtime modes in the control plane. Fix: The body now directly converges autonomy boundaries to 8 canonical runtime modes: `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plan must use `PlanGraphBundle`; execution result must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only be `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.