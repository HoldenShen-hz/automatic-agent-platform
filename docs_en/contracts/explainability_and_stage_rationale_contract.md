# Explainability And Stage Rationale Contract

## 1. Scope

This contract defines explanation pipeline, `StageRationale` data model, and explanation depth levels for `§59`.

## 2. Canonical Objects

- `StageRationale`
- `ExplanationRequest`
- `ExplanationBundle`
- `ExplanationDepth`
- `ExplanationCacheEntry`

## 3. `StageRationale` Minimum Fields

- `task_id`
- `stage`
- `summary`
- `decision_factors`
- `evidence_refs`
- `risk_notes`
- `generated_at`

## 4. Explanation Depth

`ExplanationDepth` is fixed to:

- `brief`
- `standard`
- `audit`

Rules:

- Higher depth can only add evidence and context, must not change factual conclusions.
- Explanation content must comply with data classification and redaction rules.

## 5. Test Requirements

- unit: rationale schema, depth rendering, redaction
- integration: runtime -> evidence -> explanation generation
- contract: explanation must not leak over-permission original content
