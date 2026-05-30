# Platform Ops Agent Contract

## 1. Scope

This contract defines the platform self-operations Agent, catalog, and security guardrails for §69.

## 2. Canonical Objects

- `PlatformOpsAgentDefinition`
- `OpsActionProposal`
- `OpsGuardrail`
- `OpsMaturityLevel`

## 3. `PlatformOpsAgentDefinition` Minimal Fields

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

- Self-operations Agent must not bypass panic, budget, policy, and rollout.
- Self-operations Agent default rollout guard is `no_rollout`; unapproved proposals must not enter release or canary.
- All operations actions must first form `OpsActionProposal`.
- High-impact operations actions require human approval by default.

## 6. Test Requirements

- unit: proposal validation, guardrail checks, maturity gating
- integration: health monitor -> proposal -> approval / execute
- contract: Unapproved high-risk operations actions must not take effect automatically