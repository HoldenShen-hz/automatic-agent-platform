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

`OpsMaturityLevel` 必须与 canonical runtime modes 对齐，采用 8 级模型（对应 §42.1 自治等级）：

- `manual_only` (0) - 仅人工操作
- `suggestion` (1) - 仅提供建议
- `supervised` (2) - 人工监督执行
- `semi_auto` (3) - 半自动执行
- `trusted_auto` (4) - 受信任自动执行
- `full_auto` (5) - 完全自动执行
- `high_auto` (6) - 高等风险自动执行
- `unrestricted_auto` (7) - 无限制自动执行

## 5. 规则

- 自运维 Agent 不能绕过 panic、budget、policy 和 rollout。
- 所有运维动作必须先形成 `OpsActionProposal`。
- 高影响运维动作默认需要人工批准。

## 6. 测试要求

- unit：proposal validation、guardrail checks、maturity gating
- integration：health monitor -> proposal -> approval / execute
- contract：未批准的高风险运维动作不得自动生效

