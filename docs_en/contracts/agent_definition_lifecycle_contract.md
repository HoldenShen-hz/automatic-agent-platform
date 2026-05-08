# Agent Definition Lifecycle Contract

## 1. Scope

This contract defines `§61`'s `AgentDefinition`, `AgentVersion`, and composite canary release.

## 2. Canonical Objects

- `AgentDefinition`
- `AgentVersion`
- `AgentRolloutBinding`
- `AgentRetirementPlan`

## 3. AgentDefinition Minimum Fields

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

## 4. AgentVersion Minimum Fields

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
- contract: retired agents must not be bound to new tasks
