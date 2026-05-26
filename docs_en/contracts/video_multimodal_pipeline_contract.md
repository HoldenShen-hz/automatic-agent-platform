# Video Multimodal Pipeline Contract

## 1. Scope

This contract defines the standardized pipeline model for video multimodal input, supplementing the video subset specification of `multimodal_gateway_contract.md`.

Related documents:

- `multimodal_gateway_contract.md` — Upper-layer multimodal gateway contract
- `gateway_message_contract.md` — Message content structure

## 2. Canonical Objects

- `VideoMultimodalInput`
- `VideoFrame`
- `VideoTimeline`
- `VideoPipelineOutput`

## 3. `VideoMultimodalInput` Minimum Fields

Inherits from `MultimodalInputPart`, specialized for video modality:

- `part_id`
- `type` = `"video"`
- `content_ref` — Video URI
- `mime_type` — Required, e.g., `video/mp4`
- `video_metadata?` — Pre-injected metadata override
- `safety_labels?`
- `provenance?`
- `data_classification?`

## 4. `VideoFrame` Minimum Fields

- `frame_id`
- `timestamp_ms`
- `scene_id?`
- `image_data` — Base64 or content reference

## 5. `VideoTimeline` Minimum Fields

- `scene_id`
- `start_ms`
- `end_ms`
- `dominant_keywords`

## 6. `VideoPipelineOutput` Minimum Fields

- `metadata` — `VideoMetadata`
- `transcript` — Full transcript
- `transcript_segments` — `VideoTranscriptSegment[]`
- `scenes` — `VideoScene[]` (timeline)
- `key_frames` — `VideoFrame[]`
- `quality_assessment` — `VideoQualityAssessment`

## 7. Rules

- Video input must be standardized through a structured pipeline.
- Pipeline output order: metadata -> transcript -> scenes -> key_frames -> quality_assessment.
- If transcript segment is unavailable, it must be exposed as a `conditional` safety finding, not silently ignored.
- `quality_assessment.readiness` values: `"ready" | "conditional" | "blocked"`.
- When `metadata.duration_ms <= 0` or resolution is invalid, `readiness` must be `"blocked"`.
- `key_frames` default interval is 10 seconds, minimum 1 second.
- Scene timeline default segmentation is 15 seconds, maximum 12 scenes.

## 8. Relationship with MultimodalGateway

`VideoMultimodalInput` is the video specialization of `MultimodalInputPart`.
`VideoPipelineOutput` field mapping goes to `MultimodalGatewayResult.normalized_inputs` video summary.

## 9. Test Requirements

- unit: `VideoProcessor` covers metadata extraction, scene detection, keyframe extraction, quality assessment
- integration: video request -> gateway -> `VideoPipelineOutput`, verify transcript / scenes / keyframes / summary correctness
- contract: `VideoMultimodalInput` field completeness, `VideoTimeline` scene count boundary