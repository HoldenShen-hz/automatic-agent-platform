# Explainability And Stage Rationale Contract

## 1. Scope

This contract defines explanation pipeline, `StageRationale` data model, and explanation depth levels for `§59`.

## 2. Canonical Objects

- `StageRationale`
- `ExplanationRequest`
- `ExplanationBundle`
- `ExplanationDepth`
- `ExplanationCacheEntry`

### 2A. `ExplanationRequest` Definition

| Field | Type | Description |
| --- | --- | --- |
| `explanation_request_id` | `string` | Request ID |
| `harness_run_id` | `string` | Canonical runtime chain anchor |
| `node_run_id` | `string?` | Associated NodeRun (if node has been reached) |
| `plan_graph_id` | `string?` | PlanGraph identifier (replaces deprecated workflow_id) |
| `stage_view_ref` | `string` | OAPEFLIR stage view reference |
| `depth` | `ExplanationDepth` | Explanation depth level |
| `focus_areas?` | `string[]?` | Specific focus areas for explanation |
| `include_alternatives?` | `boolean` | Whether to include alternative decisions |
| `trace_id?` | `string?` | Trace ID for correlation |

Rules:
- `harness_run_id` / `node_run_id?` are the authoritative runtime chain identifiers; `workflow_id` and `step_id` are deprecated and must not be used.

## 3. `StageRationale` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `rationale_id` | `string` | Rationale record unique identifier |
| `harness_run_id` | `string` | Associated HarnessRun |
| `node_run_id?` | `string?` | Associated NodeRun (if node has been reached) |
| `stage_view_ref` | `string` | OAPEFLIR stage view reference |
| `task_id?` | `string?` | User-facing query purpose (**not primary key**) |
| `summary` | `string` | Stage summary |
| `decision_factors` | `string[]` | Decision factors list |
| `decision_input_ref` | `string?` | Decision input reference (assessment context/input snapshot) |
| `version_lock_ref` | `string?` | Version lock reference (plan/prompt/policy version snapshot) |
| `evidence_refs` | `string[]` | Evidence reference list |
| `visibility_labels` | `string[]?` | Visibility labels (e.g., `internal`/`confidential`/`public`) |
| `confidence` | `number?` | Confidence (0-1) |
| `alternatives` | `string[]?` | Alternative options list (for audit comparison) |
| `risk_notes` | `string?` | Risk notes |
| `generated_at` | `timestamp` | Generation timestamp |

**Rules**:
- `harness_run_id` / `node_run_id?` / `stage_view_ref` are the authoritative composite primary key; `task_id` is retained only for user-facing query purposes.
- `rationale_id` must be globally unique for tamper-proof audit.
- `decision_input_ref` links to the input context at evaluation time (including UnifiedAssessment snapshot).
- `version_lock_ref` locks the plan/prompt/policy versions at generation time to ensure reproducibility.
- `visibility_labels` must be consistent with data classification policy; users with insufficient permissions must not view high-classification label content.
- `alternatives` are used for audit tracking, recording other options considered during decision-making.

## 4. Explanation Depth

`ExplanationDepth` is fixed to:

- `L1` — Summary
- `L2` — Reasoning
- `L3` — Forensic

Rules:

- `L1` corresponds to Summary, `L2` corresponds to Reasoning, `L3` corresponds to Forensic.
- Higher depth can only add evidence and context, must not change factual conclusions.
- Explanation content must comply with data classification and redaction rules.
- Explanations must be permission-aware; over-permission evidence can only be exposed as redacted refs.
- Explanation objects must be incorporated into Evidence Plane; they must not be replaced by temporary UI text as authoritative rationale.

## v4.3 Contract Remediation

- T-68: This document originally wrote `task_id + stage` as `StageRationale` primary key. The root cause was that the explanation layer reused the old cognitive view draft and did not bind explanations to the concrete runtime chain. Fix: The main text now uses `harness_run_id / node_run_id / stage_view_ref` as the authoritative key; `task_id` is retained only for user-facing query purposes.
- T-77 / T-80: This document originally used `brief / standard / audit` depth names and did not write permission-aware / Evidence Plane constraints as explicit rules. Fix: The main text now unifies to `L1 / L2 / L3` and requires explanation objects to enter Evidence Plane with permission-aware rendering.

## 5. Testing Requirements

- unit: rationale schema, depth rendering, redaction
- integration: runtime -> evidence -> explanation generation
- contract: explanation must not leak over-permission original content