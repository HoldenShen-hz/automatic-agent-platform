# Explainability And Stage Rationale Contract

## 1. 范围

本 contract defines `§59` 的解释管线、`StageRationale` data模型和解释深度分级。

## 2. Canonical 对象

- `StageRationale`
- `ExplanationRequest`
- `ExplanationBundle`
- `ExplanationDepth`
- `ExplanationCacheEntry`

## 3. `StageRationale` 最小字段

- `task_id`
- `harness_run_id`
- `node_run_id?`
- `stage_view_ref`
- `task_id?`
- `summary`
- `decision_factors`
- `evidence_refs`
- `risk_notes`
- `generated_at`

## 4. 解释深度

`ExplanationDepth` 固定为：

- `L1_summary`
- `L2_reasoning`
- `L3_forensic`

规则：

- 更高深度只能增加证据vs上下文，不得改变事实Conclusion。
- 解释内容必须遵守data分级vs脱敏规则。

## v4.3 Contract Remediation

- T-68: 本文原先把 `task_id + stage` 写成 `StageRationale` 主键，Root cause: 解释层复用了旧认知视图草案，没有把解释对象绑定到具体运lines链。修复：正文现以 `harness_run_id / node_run_id / stage_view_ref` 为权威键，`task_id` only保留user视角查询用途。

## 5. 测试要求

- unit：rationale schema、depth rendering、redaction
- integration：runtime -> evidence -> explanation generation
- contract：解释不可泄露exceedspermission原始内容
