# Agent Definition Lifecycle Contract

## 1. 范围

本 contract defines `§61` 的 `AgentDefinition`、`AgentVersion` 和复合灰度发布。

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

规则：

- `lifecycle_state` 变更必须via显式 transition service 执lines，禁止directly覆写Status字段。
- `active -> deprecated -> retired` 迁移必须绑定 rollout / evidence / retirement 审计record。

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

## v4.3 Contract Remediation

- T-71: 本文原先只给出了Status枚举，没有defines受控迁移路径，Root cause:  agent lifecycle contract 先冻结了data形状，后补治理链，导致实现侧容易directly写字段。修复：正文现明确 lifecycle 只能via受控 transition service 推进，并要求绑定 rollout vs retirement 审计证据。
