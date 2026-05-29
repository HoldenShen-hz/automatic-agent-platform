# Platform Ops Agent Contract

## 1. 范围

本 contract defines `§69` 的平台自运维 Agent、目录和security护栏。

## 2. Canonical 对象

- `PlatformOpsAgentDefinition`
- `OpsActionProposal`
- `OpsGuardrail`
- `OpsMaturityLevel`

## 3. `PlatformOpsAgentDefinition` 最小字段

- `agent_id`
- `specialty`
- `allowed_action_types`
- `required_approvals`
- `max_autonomy_level`
- `evidence_requirements`

## 4. 成熟度等级

`OpsMaturityLevel` 固定为：

- `observe_only`
- `suggest_only`
- `supervised_execution`
- `guarded_automation`

## 5. 规则

- 自运维 Agent 不能bypassing panic、budget、policy 和 rollout。
- 自运维 Agent 的defaults to rollout guard 为 `no_rollout`；未审批的 proposal 不得进入发布或灰度。
- 所有运维动作必须先形成 `OpsActionProposal`。
- 高Impact运维动作defaults to需要人工批准。

## 6. 测试要求

- unit：proposal validation、guardrail checks、maturity gating
- integration：health monitor -> proposal -> approval / execute
- contract：未批准的高风险运维动作不得自动生效
