# Explainability And Stage Rationale Contract

## 1. Scope

This contract defines the explanation pipeline, the `StageRationale` data model, and explanation depth tiers for §59.

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

- Higher depth can only add evidence and context; it must not change factual conclusions.
- Explanation content must obey data classification and redaction rules.

## v4.3 Contract Remediation

- T-68: This document previously wrote `task_id + stage` as the `StageRationale` primary key. Root cause: the explanation layer reused a legacy cognitive view draft and did not bind the explanation object to a specific runtime chain. Fix: the body now uses `harness_run_id / node_run_id / stage_view_ref` as the authoritative key; `task_id` is retained only for user-perspective lookup purposes.

## 5. Testing Requirements

- unit: rationale schema, depth rendering, redaction
- integration: runtime -> evidence -> explanation generation
- contract: explanations must not leak over-permission raw content
