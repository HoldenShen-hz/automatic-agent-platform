# Proactive Agent And Autonomy Contract

## 1. Scope

This contract defines the proactive triggers, suggestion pipeline, and progressive autonomy for `§41-§42`.

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

- All proactive behavior must first register a trigger.
- Proactive execution without a declared trigger must be denied and audited.

## 4. Execution Mode and Autonomy Boundaries

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

- Autonomy contract must directly reference canonical `runtime_mode` and must not substitute with independent enums like `trusted_auto_execute`.
- `manual_only`, `read_only`, `no-write`, `no-external-call`, `no-rollout`, `incident-mode` are all triggerable real governance modes, not descriptive labels.
- If product or UI still needs to display narrative-level concepts like `suggest_only / supervised_execute`, they can only be view mappings, not runtime truth.

## 5. Trust Score and Change Audit

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

## 6. Execution Rules

- Trigger firing does not mean automatic execution; the final mode depends on `AutonomyProfile.runtime_mode`.
- Consecutive failures, risk escalation, or human否决 must support degradation or freezing.
- Proactive suggestions must be traceable for acceptance rate and false positive rate.

Supplementary rules:

- High-risk domains default to not entering `full_auto`; should start from `supervised_auto` or more conservative modes.
- Degradation must monotonically tighten along `degrade_path`, e.g., `full_auto -> supervised_auto -> no-write -> manual_only -> incident-mode`.
- Proactive triggers hitting `no-rollout` or `manual_only` can only form `ProactiveSuggestion` and must not directly dispatch execution.

## 7. Test Requirements

- unit: trigger evaluation, rate limit, cooldown, autonomy transitions
- integration: trigger -> suggestion / execution
- contract: high-risk triggers must be blocked at low autonomy levels


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-25: This document originally used `manual_only / suggest_only / supervised_execute / trusted_auto_execute` four-level autonomy ladder; root cause was early product design wanted to express user-perceived automation strength without one-to-one binding with the control plane's canonical execution modes. Fix: The main text now directly converges the autonomy boundary to eight canonical runtime modes: `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.