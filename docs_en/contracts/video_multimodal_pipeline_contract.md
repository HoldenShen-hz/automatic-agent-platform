# Video Multimodal Pipeline Contract

## 1. Scope

This contract defines the standardized pipeline model for video multimodal input, supplementing the video subset specification of `multimodal_gateway_contract.md`.

Related documents:

- `multimodal_gateway_contract.md` — upper-layer multimodal gateway contract
- `gateway_message_contract.md` — message content structure

## 2. Canonical Objects

- `VideoMultimodalInput`
- `VideoFrame`
- `VideoTimeline`
- `VideoPipelineOutput`

## 3. `VideoMultimodalInput` Minimum Fields

Inherits from `MultimodalInputPart`, specialized for video modality:

- `part_id`
- `type` = `"video"`
- `content_ref` — video URI
- `mime_type` — required, e.g., `video/mp4`
- `video_metadata?` — pre-injected metadata override
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
- `transcript` — full-text transcription
- `transcript_segments` — `VideoTranscriptSegment[]`
- `scenes` — `VideoScene[]` (timeline)
- `key_frames` — `VideoFrame[]`
- `quality_assessment` — `VideoQualityAssessment`

## 7. Rules

- Video input must be standardized through the structured pipeline.
- Pipeline output order: metadata -> transcript -> scenes -> key_frames -> quality_assessment.
- If a transcript segment is unavailable, it must be exposed as a `conditional` safety finding, rather than silently ignored.
- `quality_assessment.readiness` value: `"ready" | "conditional" | "blocked"`.
- When `metadata.duration_ms <= 0` or the resolution is invalid, `readiness` must be `"blocked"`.
- `key_frames` interval defaults to 10 seconds, minimum 1 second.
- Scene timeline is split by 15 seconds by default, with at most 12 scenes.

## 8. Relationship with MultimodalGateway

`VideoMultimodalInput` is the video specialization of `MultimodalInputPart`.
The fields of `VideoPipelineOutput` map to the video summary of `MultimodalGatewayResult.normalized_inputs`.

## 9. Testing Requirements

- unit: `VideoProcessor` covers metadata extraction, scene detection, keyframe extraction, and quality assessment
- integration: video request -> gateway -> `VideoPipelineOutput`, verify transcript / scenes / keyframes / summary are correct
- contract: `VideoMultimodalInput` field completeness, `VideoTimeline` scene count boundary
