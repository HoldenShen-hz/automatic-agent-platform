# Artifact Unified Model Contract

## 1. Scope

This contract unifies `output`, `step output`, and `artifact` result representations, avoiding the mixed use of text results, structured results, and file artifacts.

Related documents:

- `result_envelope_contract.md`
- `artifact_store_contract.md`
- `task_and_workflow_contract.md`

## 2. Goals

- Clarify that user-readable results and file artifacts are not the same type of object.
- Unify the boundary between intermediate structured output and final deliverables.
- Provide unified semantics for inspect, replay, download, and retention.

## 3. Unified Objects

- `HumanOutput`: Conclusions or summaries displayed to users
- `StructuredStepOutput`: Structured intermediate results of workflows / steps
- `ArtifactRecord`: Physical artifacts such as files, images, reports, and compressed packages

`ArtifactType` currently should at least cover:

- `report`
- `evidence_bundle`
- `timeline_export`
- `diagnostic_bundle`
- `workflow_checkpoint`
- `feedback_snapshot`
- `learning_object_bundle`
- `improvement_candidate_bundle`
- `rollout_evidence`
- `policy_explain_export`

`BundleType` currently should at least cover:

- `task_result`
- `incident`
- `promotion_evidence`
- `release_evidence`

`publishStatus` lifecycle:

- `draft`
- `preview`
- `published`
- `archived`

## 4. Rules

- `HumanOutput` may reference artifacts but cannot replace artifact indexes.
- `StructuredStepOutput` is used for subsequent step dependencies and should not be directly exposed to users by default.
- `ArtifactRecord` is always accessed through indexes and permission controls, not directly embedded in message bodies.
- When cross closed-loop objects reference artifacts, `ArtifactRef` should be preferred; do not directly embed local paths or blobs.

## 5. Closure Conclusion

The key to a unified artifact model is not adding new objects but letting "text conclusions, structured results, and file artifacts" each find their proper place.
