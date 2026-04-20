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

- `task_id`
- `stage`
- `summary`
- `decision_factors`
- `evidence_refs`
- `risk_notes`
- `generated_at`

## 4. 解释深度

`ExplanationDepth` 固定为：

- `brief`
- `standard`
- `audit`

规则：

- 更高深度只能增加证据与上下文，不得改变事实结论。
- 解释内容必须遵守数据分级与脱敏规则。

## 5. 测试要求

- unit：rationale schema、depth rendering、redaction
- integration：runtime -> evidence -> explanation generation
- contract：解释不可泄露超权限原始内容

