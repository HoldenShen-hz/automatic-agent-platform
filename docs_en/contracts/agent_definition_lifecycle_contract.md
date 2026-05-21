# Agent Definition Lifecycle Contract

## 1. Scope

This contract defines `§61`'s `AgentDefinition`, `AgentVersion`, and composite canary release.

## 2. Canonical Objects

- `AgentDefinition`
- `AgentVersion`
- `AgentRolloutBinding`
- `AgentRetirementPlan`

## 3. `AgentDefinition` Minimum Fields

- `agent_id`
- `display_name`
- `domain_id`
- `capabilities`
- `owner`
- `lifecycle_state`
- `current_version_id`

`lifecycle_state`:

- `draft`
- `validated`
- `canary`
- `active`
- `deprecated`
- `retired`

Rules:

- `lifecycle_state` changes must be executed through explicit transition service; direct field overwrite is prohibited.
- `active -> deprecated -> retired` migration must bind rollout / evidence / retirement audit records.

## 4. `AgentVersion` Minimum Fields

- `version_id`
- `agent_id`
- `prompt_refs`
- `tool_bundle_refs`
- `policy_refs`
- `model_profile_refs`
- `created_at`

## 5. Testing Requirements

- unit: agent lifecycle, version snapshot integrity
- integration: agent rollout / rollback / retirement
- contract: retired agent must not be bound by new tasks

## v4.3 Contract Remediation

- T-71: This document previously only gave state enums without defining controlled migration paths. The root cause was that agent lifecycle contract froze data shape first, then added governance chain, leading to implementation side easily writing fields directly. Fix: The text now explicitly states lifecycle can only advance through controlled transition service, and requires binding rollout and retirement audit evidence.