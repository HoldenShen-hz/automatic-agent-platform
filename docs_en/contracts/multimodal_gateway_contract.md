# Multimodal Gateway Contract

## 1. Scope

This contract defines the multimodal `ModelGateway` extension for `§68`, request structure, and security boundaries.

## 2. Canonical Objects

- `MultimodalRequest`
- `MultimodalInputPart`
- `ModalityRouteDecision`
- `MultimodalSafetyFinding`

## 3. `MultimodalRequest` Minimum Fields

- `request_id`
- `harness_run_id` — canonical execution association (required)
- `node_run_id?` — canonical node association
- `tenant_id` — tenant association (required)
- `trace_id` — trace association (required)
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
- Modality inputs that fail safety checks must not enter model calls.
- `video` input must be standardized through structured video pipeline, producing at minimum metadata, scene timeline, keyframe, quality/readiness assessment; if transcript segment is unavailable, it must be exposed as conditional safety finding rather than silently ignored.

## 5. Test Requirements

- unit: request validation, route decision, safety findings
- integration: multimodal request -> gateway -> output, with `video` path covering transcript segment, scene timeline, keyframe, and gateway summary
- contract: illegal modality types must not silently degrade to text-only execution

## 6. Export and Compatibility Rules

- When multimodal requests, routing decisions, and safety findings enter API, event, or audit export chains, must preserve `harness_run_id`, `node_run_id?`, `tenant_id`, `trace_id`, and `safety_policy_ref`.
- If legacy `execution_id` still exists in adapter layer, can only serve as query alias and must not replace canonical runtime association fields.
- Derived artifacts from `video`, `audio`, `document` must be exported through `ArtifactRef` and must not embed large objects directly into the main request envelope.
- Multimodal provider fallback must explicitly record `ModalityRouteDecision` and must not silently switch to text-only path.
- After safety pruning, input must preserve pruning summary and original artifact reference for audit and recovery.

## v4.3 Contract Remediation

- T-45A: The early version of this document was less than 60 lines and lacked v4.3 contract remediation and canonical runtime association constraints. Root cause: the multimodal gateway contract froze input types first but did not synchronously bind the canonical execution anchor set `HarnessRun / NodeRun / trace / budget`. Fix: The body now adds `harness_run_id`, `node_run_id`, `tenant_id`, `trace_id`, and `cost_budget` fields, and solidifies remediation in this section.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger / BudgetReservation / BudgetSettlement`.
