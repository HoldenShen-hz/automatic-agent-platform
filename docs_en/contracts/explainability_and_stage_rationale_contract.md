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

| Field | Type | Description |
| --- | --- | --- |
| `rationale_id` | `string` | Rationale record unique identifier |
| `harness_run_id` | `string` | Associated HarnessRun |
| `node_run_id?` | `string?` | Associated NodeRun (if node reached) |
| `stage_view_ref` | `string` | OAPEFLIR stage view reference |
| `task_id?` | `string?` | User perspective query use (**not primary key**) |
| `summary` | `string` | Stage summary |
| `decision_factors` | `string[]` | Decision factors list |
| `decision_input_ref` | `string?` | Decision input reference (evaluation context/input snapshot) |
| `version_lock_ref` | `string?` | Version lock reference (plan/prompt/policy version snapshot) |
| `evidence_refs` | `string[]` | Evidence reference list |
| `visibility_labels` | `string[]?` | Visibility labels (e.g., `internal`/`confidential`/`public`) |
| `confidence` | `number?` | Confidence (0-1) |
| `alternatives` | `string[]?` | Alternative options list (for audit comparison) |
| `rendered_explanation` | `string?` | User or auditor facing rendered result |
| `risk_notes` | `string?` | Risk notes |
| `generated_at` | `timestamp` | Generation time |

**Rules**:
- `harness_run_id` / `node_run_id?` / `stage_view_ref` is the authoritative composite primary key; `task_id` is retained only for user perspective query use.
- `rationale_id` must be globally unique, used for tamper-proof audit.
- `decision_input_ref` links to the input context at evaluation time (including UnifiedAssessment snapshot).
- `version_lock_ref` locks the plan/prompt/policy version at generation time to ensure reproducibility.
- `visibility_labels` must be consistent with data classification policy; users exceeding permission must not view high-security label content.
- `alternatives` are used for audit tracking, recording other options considered during decision-making.

## 4. Explanation Depth

`ExplanationDepth` is fixed as:

- `L1`
- `L2`
- `L3`

Rules:

- `L1` corresponds to Summary, `L2` to Reasoning, `L3` to Forensic.
- Higher depth can only add evidence and context, must not change factual conclusions.
- Explanation content must comply with data classification and desensitization rules.
- Explanations must be permission-aware; any evidence exceeding permissions can only be exposed as redacted refs.
- Explanation objects must be included in Evidence Plane, not substituted by temporary UI text as authoritative rationale.

## v4.3 Contract Remediation

- T-68: This document originally wrote `task_id + stage` as `StageRationale` primary key. Root cause: explanation layer reused old cognitive view draft without binding explanation objects to specific run chain. Fix: The text now uses `harness_run_id / node_run_id / stage_view_ref` as authoritative key; `task_id` retained only for user perspective query use.
- T-77 / T-80: This document originally used `brief / standard / audit` depth names, and did not write permission-aware / Evidence Plane constraints as explicit rules. Fix: The text now uniformly converges to `L1 / L2 / L3`, and requires explanation objects to enter Evidence Plane and comply with permission-aware rendering.

## 5. Test Requirements

- unit: rationale schema, depth rendering, redaction
- integration: runtime -> evidence -> explanation generation
- contract: explanations must not leak content beyond permissions
