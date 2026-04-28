# Explainability And Stage Rationale Contract

## 1. 范围

本 contract 定义 `§59` 的解释管线、`StageRationale` 数据模型和解释深度分级。

## 2. Canonical 对象

- `StageRationale`
- `ExplanationRequest`
- `ExplanationBundle`
- `ExplanationDepth`
- `ExplanationCacheEntry`

## 3. `StageRationale` 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `rationale_id` | `string` | 理由记录唯一标识 |
| `harness_run_id` | `string` | 关联 HarnessRun |
| `node_run_id?` | `string?` | 关联 NodeRun（如已到达节点） |
| `stage_view_ref` | `string` | OAPEFLIR stage 视图引用 |
| `task_id?` | `string?` | 用户视角查询用途（**非主键**） |
| `summary` | `string` | 阶段总结 |
| `decision_factors` | `string[]` | 决策因素列表 |
| `decision_input_ref` | `string?` | 决策输入引用（评估上下文/输入快照） |
| `version_lock_ref` | `string?` | 版本锁定引用（plan/prompt/policy 版本快照） |
| `evidence_refs` | `string[]` | 证据引用列表 |
| `visibility_labels` | `string[]?` | 可见性标签（如 `internal`/`confidential`/`public`） |
| `confidence` | `number?` | 置信度（0-1） |
| `alternatives` | `string[]?` | 候选方案列表（用于审计对比） |
| `risk_notes` | `string?` | 风险备注 |
| `generated_at` | `timestamp` | 生成时间 |

**规则**：
- `harness_run_id` / `node_run_id?` / `stage_view_ref` 是权威复合主键，`task_id` 仅保留用户视角查询用途。
- `rationale_id` 必须全局唯一，用于不可篡改性审计。
- `decision_input_ref` 链接到评估时的输入上下文（含 UnifiedAssessment snapshot）。
- `version_lock_ref` 锁定生成时刻的 plan/prompt/policy 版本，保证可复现性。
- `visibility_labels` 必须与数据分级策略一致，超权限用户不得查看高密级标签内容。
- `alternatives` 用于审计追踪，记录决策时考虑过的其他方案。

## 4. 解释深度

`ExplanationDepth` 固定为：

- `brief`
- `standard`
- `audit`

规则：

- 更高深度只能增加证据与上下文，不得改变事实结论。
- 解释内容必须遵守数据分级与脱敏规则。

## v4.3 Contract Remediation

- T-68: 本文原先把 `task_id + stage` 写成 `StageRationale` 主键，根因是解释层复用了旧认知视图草案，没有把解释对象绑定到具体运行链。修复：正文现以 `harness_run_id / node_run_id / stage_view_ref` 为权威键，`task_id` 仅保留用户视角查询用途。

## 5. 测试要求

- unit：rationale schema、depth rendering、redaction
- integration：runtime -> evidence -> explanation generation
- contract：解释不可泄露超权限原始内容
