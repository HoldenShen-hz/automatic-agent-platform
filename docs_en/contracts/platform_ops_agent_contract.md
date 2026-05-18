# Platform Ops Agent Contract

## 1. Scope

This contract defines the platform self-ops Agent, catalog, and security guardrails as specified in `§69`.

## 2. Canonical Objects

- `PlatformOpsAgentDefinition`
- `OpsActionProposal`
- `OpsGuardrail`
- `OpsMaturityLevel`

## 3. `PlatformOpsAgentDefinition` Minimum Fields

- `agent_id`
- `specialty`
- `allowed_action_types`
- `required_approvals`
- `max_autonomy_level`
- `evidence_requirements`

## 4. Maturity Levels

`OpsMaturityLevel` is fixed as:

- `observe_only`
- `suggest_only`
- `supervised_execution`
- `guarded_automation`

## 5. Rules

- Self-ops Agent must not bypass panic, budget, policy, and rollout.
- Self-ops Agent default rollout guard is `no_rollout`; unapproved proposals must not enter release or canary.
- All ops actions must first form `OpsActionProposal`.
- High-impact ops actions require human approval by default.

## 6. Test Requirements

- unit: proposal validation, guardrail checks, maturity gating
- integration: health monitor -> proposal -> approval / execute
- contract: unapproved high-risk ops actions must not take effect automatically