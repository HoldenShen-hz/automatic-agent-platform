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
- `video`

## 4. 规则

- 多模态请求必须沿用统一 trace、budget 和 policy 约束。
- `ModalityRouter` 必须显式选择 provider / processor。
- 未通过安全检查的模态输入不得进入模型调用。
- `video` 输入必须通过结构化 video pipeline 标准化，至少产出 metadata、scene timeline、keyframe、quality/readiness assessment；若 transcript segment 不可得，必须以 conditional safety finding 暴露，而不是静默忽略。

## 5. 测试要求

- unit：request validation、route decision、safety findings
- integration：multimodal request -> gateway -> output，且 `video` 路径需覆盖 transcript segment、scene timeline、keyframe 与 gateway summary
- contract：非法模态类型不得静默降级为文本执行
