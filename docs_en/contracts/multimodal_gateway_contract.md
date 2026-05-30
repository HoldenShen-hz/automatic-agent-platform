# Multimodal Gateway Contract

## 1. Scope

This contract defines the multimodal `ModelGateway` extension, request structure, and security boundary for `§68`.

## 2. Canonical Objects

- `MultimodalRequest`
- `MultimodalInputPart`
- `ModalityRouteDecision`
- `MultimodalSafetyFinding`
- `VideoPipelineOutput`
- `VideoTranscriptSegment`
- `VideoTimeline`
- `VideoFrame`

## 3. `MultimodalRequest` Minimum Fields

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

`input_parts.type` must support at minimum:

- `text`
- `image`
- `audio`
- `document`
- `video`

## 4. Rules

- Multimodal requests must adhere to unified trace, budget, and policy constraints.
- `ModalityRouter` must explicitly select provider / processor.
- Modality inputs that fail security checks must not enter model invocation.
- `video` input must be normalized through a structured video pipeline, producing at minimum metadata, scene timeline, keyframe, and quality/readiness assessment; if transcript segment is unavailable, it must be exposed as a conditional safety finding, not silently ignored.
- The scene timeline / keyframe / transcript segment structure for video pipeline must follow `video_multimodal_pipeline_contract.md`; gateway must not compress these fields into untrackable free-text summaries.

## 5. Test Requirements

- unit: request validation, route decision, safety findings
- integration: multimodal request -> gateway -> output, with `video` path covering transcript segment, scene timeline, keyframe vs gateway summary
- contract: illegal modality types must not silently degrade to text execution