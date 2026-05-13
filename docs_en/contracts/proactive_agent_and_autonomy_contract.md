# Proactive Agent And Autonomy Contract

## 1. Scope

This contract defines proactive triggers, suggestion pipelines, and gradual autonomy for `§41-§42`.

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
- Undeclared trigger-based proactive execution must be rejected and audited.

## 4. Runtime Mode and Autonomy Boundary

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

- The autonomy contract must directly reference canonical `runtime_mode` and must not use independent enums like `trusted_auto_execute` as substitutes.
- `manual_only`, `read_only`, `no-write`, `no-external-call`, `no-rollout`, `incident-mode` are all triggerable real governance modes, not descriptive labels.
- If a product or UI still needs to display narrative-level concepts like `suggest_only / supervised_execute`, these may only be used as view mappings and must not be used as runtime truth.

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

## 6. Operating Rules

- Trigger firing does not guarantee automatic execution; final mode depends on `AutonomyProfile.runtime_mode`.
- Continuous failures, risk escalation, or human veto must support demotion or freezing.
- Proactive suggestions must be trackable for acceptance rate and false positive rate.

Supplementary rules:

- High-risk domains must not enter `full_auto` by default; they should start at `supervised_auto` or a more conservative mode.
- Demotion must monotonically tighten along `degrade_path`, e.g., `full_auto -> supervised_auto -> no-write -> manual_only -> incident-mode`.
- If a proactive trigger hits `no-rollout` or `manual_only`, it can only produce a `ProactiveSuggestion` and must not directly dispatch execution.

## 7. Test Requirements

- unit: trigger evaluation, rate limit, cooldown, autonomy transitions
- integration: trigger -> suggestion / execution
- contract: high-risk triggers must be blocked at low autonomy levels



## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-25: This document previously used a four-level autonomy ladder: `manual_only / suggest_only / supervised_execute / trusted_auto_execute`. Root cause: early product design wanted to express the user's perception of automation strength but did not bind it one-to-one with the control plane's canonical runtime modes. Fix: the main text now directly converges autonomy boundaries to the 8 canonical runtime modes: `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.