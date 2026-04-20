# Agent Definition Lifecycle Contract

## 1. 范围

本 contract 定义 `§61` 的 `AgentDefinition`、`AgentVersion` 和复合灰度发布。

## 2. Canonical 对象

- `AgentDefinition`
- `AgentVersion`
- `AgentRolloutBinding`
- `AgentRetirementPlan`

## 3. `AgentDefinition` 最小字段

- `agent_id`
- `display_name`
- `domain_id`
- `capabilities`
- `owner`
- `lifecycle_state`
- `current_version_id`

`lifecycle_state`：

- `draft`
- `validated`
- `canary`
- `active`
- `deprecated`
- `retired`

## 4. `AgentVersion` 最小字段

- `version_id`
- `agent_id`
- `prompt_refs`
- `tool_bundle_refs`
- `policy_refs`
- `model_profile_refs`
- `created_at`

## 5. 测试要求

- unit：agent lifecycle、version snapshot integrity
- integration：agent rollout / rollback / retirement
- contract：已退役 agent 不得被新任务绑定

