# Multimodal Gateway Contract

## 1. Scope

This contract defines the multimodal `ModelGateway` extension, request structure, and security boundaries for `§68`.

## 2. Canonical Objects

- `MultimodalRequest`
- `MultimodalInputPart`
- `ModalityRouteDecision`
- `MultimodalSafetyFinding`

## 3. `MultimodalRequest` Minimum Fields

- `request_id`
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

- Multimodal requests must follow unified trace, budget, and policy constraints.
- `ModalityRouter` must explicitly select provider / processor.
- Modality inputs that fail security checks must not enter model calls.
- `video` input must be standardized through a structured video pipeline, producing at minimum metadata, scene timeline, keyframe, quality/readiness assessment; if transcript segment is unavailable, must expose as conditional safety finding rather than silently ignoring.

## 5. Test Requirements

- unit: request validation, route decision, safety findings
- integration: multimodal request -> gateway -> output, and `video` path must cover transcript segment, scene timeline, keyframe, and gateway summary
- contract: Illegal modality types must not silently degrade to text execution
