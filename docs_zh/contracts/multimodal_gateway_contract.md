# Multimodal Gateway Contract

## 1. 范围

本 contract 定义 `§68` 的多模态 `ModelGateway` 扩展、请求结构和安全边界。

## 2. Canonical 对象

- `MultimodalRequest`
- `MultimodalInputPart`
- `ModalityRouteDecision`
- `MultimodalSafetyFinding`

## 3. `MultimodalRequest` 最小字段

- `request_id`
- `modalities`
- `input_parts`
- `requested_outputs`
- `safety_policy_ref`
- `cost_budget`

`input_parts.type` 至少支持：

- `text`
- `image`
- `audio`
- `document`

## 4. 规则

- 多模态请求必须沿用统一 trace、budget 和 policy 约束。
- `ModalityRouter` 必须显式选择 provider / processor。
- 未通过安全检查的模态输入不得进入模型调用。

## 5. 测试要求

- unit：request validation、route decision、safety findings
- integration：multimodal request -> gateway -> output
- contract：非法模态类型不得静默降级为文本执行

