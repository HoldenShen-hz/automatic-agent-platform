# Platform Ops Agent Contract

## 1. 范围

本 contract 定义 `§69` 的平台自运维 Agent、目录和安全护栏。

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

`OpsMaturityLevel` 必须直接复用 canonical `UnifiedRuntimeMode`，不得再发明一套近似枚举：

- `full_auto`
- `supervised_auto`
- `read_only`
- `no_write`
- `no_external_call`
- `no_rollout`
- `manual_only`
- `incident_mode`

说明：

- `OpsMaturityLevel` 不是 interaction autonomy ladder；它表达的是平台运行时允许的操作边界。
- 若 UI / agent 侧存在 `suggestion / supervised / semi_auto / full_auto / frozen`，必须先映射到 `UnifiedRuntimeMode` 再驱动 self-ops 执行面。

## 5. 规则

- 自运维 Agent 不能绕过 panic、budget、policy 和 release。
- 所有运维动作必须先形成 `OpsActionProposal`。
- 高影响运维动作默认需要人工批准。

## 6. 测试要求

- unit：proposal validation、guardrail checks、maturity gating
- integration：health monitor -> proposal -> approval / execute
- contract：未批准的高风险运维动作不得自动生效
