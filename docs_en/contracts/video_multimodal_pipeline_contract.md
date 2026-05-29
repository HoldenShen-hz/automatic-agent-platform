# Video Multimodal Pipeline Contract

## 1. 范围

本 contract defines视频多模态输入的标准化管道模型，补充 `multimodal_gateway_contract.md` 的 video 子集规范。

相关文档：

- `multimodal_gateway_contract.md` — 上层多模态网关契约
- `gateway_message_contract.md` — 消息内容结构

## 2.  Canonical 对象

- `VideoMultimodalInput`
- `VideoFrame`
- `VideoTimeline`
- `VideoPipelineOutput`

## 3. `VideoMultimodalInput` 最小字段

继承自 `MultimodalInputPart`，特化 video 模态：

- `part_id`
- `type` = `"video"`
- `content_ref` — 视频 URI
- `mime_type` — 必填，如 `video/mp4`
- `video_metadata?` — 提前注入的元data覆盖
- `safety_labels?`
- `provenance?`
- `data_classification?`

## 4. `VideoFrame` 最小字段

- `frame_id`
- `timestamp_ms`
- `scene_id?`
- `image_data` — Base64 或内容references用

## 5. `VideoTimeline` 最小字段

- `scene_id`
- `start_ms`
- `end_ms`
- `dominant_keywords`

## 6. `VideoPipelineOutput` 最小字段

- `metadata` — `VideoMetadata`
- `transcript` — 全文转录
- `transcript_segments` — `VideoTranscriptSegment[]`
- `scenes` — `VideoScene[]`（timeline）
- `key_frames` — `VideoFrame[]`
- `quality_assessment` — `VideoQualityAssessment`

## 7. 规则

- Video 输入必须via过结构化 pipeline 标准化。
- Pipeline 产出顺序：metadata -> transcript -> scenes -> key_frames -> quality_assessment。
- 若 transcript segment 不可得，必须以 `conditional` safety finding 暴露，而不is静默忽略。
- `quality_assessment.readiness` 取值：`"ready" | "conditional" | "blocked"`。
- 当 `metadata.duration_ms <= 0` 或分辨率no效时，`readiness` 必须为 `"blocked"`。
- `key_frames` 间隔defaults to 10 秒，最小 1 秒。
- scene timeline defaults to按 15 秒切分，最多 12 scenes。

## 8. vs MultimodalGateway 的关系

`VideoMultimodalInput` is `MultimodalInputPart` 的 video 特化。
`VideoPipelineOutput` 的字段映射到 `MultimodalGatewayResult.normalized_inputs` 的 video summary。

## 9. 测试要求

- unit：`VideoProcessor` 覆盖 metadata 提取、scene 检测、keyframe 提取、质量评估
- integration：video request -> gateway -> `VideoPipelineOutput`，验证 transcript / scenes / keyframes / summary 正确
- contract：`VideoMultimodalInput` 字段完整性、`VideoTimeline` scene count 边界
