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

`OpsMaturityLevel` must align with canonical runtime modes, using an 8-level model (corresponding to §42.1 autonomy levels):

- `manual_only` (0) - Manual operations only
- `suggestion` (1) - Suggestions only
- `supervised` (2) - Human-supervised execution
- `semi_auto` (3) - Semi-automatic execution
- `trusted_auto` (4) - Trusted automatic execution
- `full_auto` (5) - Fully automatic execution
- `high_auto` (6) - High-risk automatic execution
- `unrestricted_auto` (7) - Unrestricted automatic execution

## 5. Rules

- Self-operations Agents must not bypass panic, budget, policy, and release.
- All operations actions must first form an `OpsActionProposal`.
- High-impact operations actions require human approval by default.

## 6. Test Requirements

- unit: proposal validation, guardrail checks, maturity gating
- integration: health monitor -> proposal -> approval / execute
- contract: unapproved high-risk operations actions must not take effect automatically
