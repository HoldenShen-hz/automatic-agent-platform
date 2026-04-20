# Multimodal Gateway Contract

## 1. Scope

This contract defines the multimodal `ModelGateway` extension, request structure, and security boundary for `§68`.

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

## 4. Rules

- Multimodal requests must follow unified trace, budget, and policy constraints.
- `ModalityRouter` must explicitly select provider / processor.
- Modality inputs that fail safety checks must not enter model invocation.

## 5. Test Requirements

- unit: request validation, route decision, safety findings
- integration: multimodal request -> gateway -> output
- contract: illegal modality types must not silently degrade to text execution