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

**Rules**:

- `lifecycle_state` transitions **must** be executed through `RuntimeStateMachine.transition({ target: 'lifecycle_state', newState: X })`, **prohibited** from directly overwriting status fields.
- `active -> deprecated -> retired` transitions **must** bind rollout / evidence / retirement audit records.
- Any direct assignment operation that bypasses the state machine violates INV-LIFECYCLE-001 and must be blocked in code review.

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

- T-71: This document originally only gave state enumeration without defining controlled migration paths. The root cause was that the agent lifecycle contract froze the data shape first and then added governance, making it easy for implementation to write fields directly. Fix: The main text now explicitly states that lifecycle can only progress through the controlled transition service, and requires binding rollout and retirement audit evidence.