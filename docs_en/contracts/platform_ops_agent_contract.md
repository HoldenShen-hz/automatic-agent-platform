# Platform Ops Agent Contract

## 1. Scope

This contract defines the platform self-operations Agent, catalog, and security guardrails for `§69`.

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

`OpsMaturityLevel` is fixed to:

- `observe_only`
- `suggest_only`
- `supervised_execution`
- `trusted_automation`

## 5. Rules

- Self-operations Agents must not bypass panic, budget, policy, or rollout.
- All operations actions must first form an `OpsActionProposal`.
- High-impact operations actions require human approval by default.

## 6. Test Requirements

- unit: proposal validation, guardrail checks, maturity gating
- integration: health monitor -> proposal -> approval / execute
- contract: unapproved high-risk operations actions must not take effect automatically
