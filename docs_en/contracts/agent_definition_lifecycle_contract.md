# Agent Definition Lifecycle Contract

## 1. Scope

This contract defines `§61`'s `AgentDefinition`, `AgentVersion`, and compound canary release.

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
- `active -> deprecated -> retired` migration must be bound to rollout / evidence / retirement audit records.

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
- contract: retired agents must not be bound to new tasks

## v4.3 Contract Remediation

- T-71: This document originally only provided state enums without defining controlled migration paths. Root cause: The agent lifecycle contract froze the data shape first and added the governance chain later, causing implementation side to easily write fields directly. Fix: The main text now explicitly states that lifecycle can only advance through controlled transition service, and requires binding rollout and retirement audit evidence.