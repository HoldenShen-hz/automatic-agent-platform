# Explainability And Stage Rationale Contract

## 1. Scope

This contract defines the explanation pipeline for `§59`, `StageRationale` data model, and explanation depth levels.

## 2. Canonical Objects

- `StageRationale`
- `ExplanationRequest`
- `ExplanationBundle`
- `ExplanationDepth`
- `ExplanationCacheEntry`

## 3. `StageRationale` Minimum Fields

- `task_id`
- `harness_run_id`
- `node_run_id?`
- `stage_view_ref`
- `task_id?`
- `summary`
- `decision_factors`
- `evidence_refs`
- `risk_notes`
- `generated_at`

## 4. Explanation Depth

`ExplanationDepth` is fixed to:

- `L1_summary`
- `L2_reasoning`
- `L3_forensic`

Rules:

- Higher depth can only add evidence and context, must not change factual conclusions.
- Explanation content must comply with data classification and redaction rules.

## v4.3 Contract Remediation

- T-68: This document originally wrote `task_id + stage` as `StageRationale` primary key. The root cause is that the explanation layer reused the old cognition view draft, and the explanation object was not bound to the specific runtime chain. Fix: The main text now uses `harness_run_id / node_run_id / stage_view_ref` as the authoritative key, and `task_id` is retained only for user-facing query purposes.

## 5. Test Requirements

- unit: rationale schema, depth rendering, redaction
- integration: runtime -> evidence -> explanation generation
- contract: explanation must not leak over-permission original content