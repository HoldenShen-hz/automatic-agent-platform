# Multimodal Gateway Contract

## 1. 范围

本 contract defines `§68` 的多模态 `ModelGateway` 扩展、request结构和security边界。

## 2. Canonical 对象

- `MultimodalRequest`
- `MultimodalInputPart`
- `ModalityRouteDecision`
- `MultimodalSafetyFinding`
- `VideoPipelineOutput`
- `VideoTranscriptSegment`
- `VideoTimeline`
- `VideoFrame`

## 3. `MultimodalRequest` 最小字段

- `request_id`
- `harness_run_id`
- `node_run_id?`
- `tenant_id`
- `trace_id`
- `modalities`
- `input_parts`
- `requested_outputs`
- `safety_policy_ref`
- `cost_budget`

`input_parts.type` 至少supported：

- `text`
- `image`
- `audio`
- `document`
- `video`

## 4. 规则

- 多模态request必须accesses along用统一 trace、budget 和 policy 约束。
- `ModalityRouter` 必须显式选择 provider / processor。
- 未viasecurity检查的模态输入不得进入模型call。
- `video` 输入必须via结构化 video pipeline 标准化，至少产出 metadata、scene timeline、keyframe、quality/readiness assessment；若 transcript segment 不可得，必须以 conditional safety finding 暴露，而不is静默忽略。
- video pipeline 的 scene timeline / keyframe / transcript segment 结构以 `video_multimodal_pipeline_contract.md` 为准，gateway 不得把这些字段压缩成不可追踪的自由文本摘要。

## 5. 测试要求

- unit：request validation、route decision、safety findings
- integration：multimodal request -> gateway -> output，且 `video` 路径需覆盖 transcript segment、scene timeline、keyframe vs gateway summary
- contract：非法模态class型不得静默降级为文本执lines
