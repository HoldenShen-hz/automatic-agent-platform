# Artifact Unified Model Contract

> **OAPEFLIR Association**: This contract defines the unified model for the OAPEFLIR Artifact Plane, corresponding to ADR-016 §11.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract unifies the expression of three result types: `output`, `step output`, and `artifact`, to avoid mixing text results, structured results, and file artifacts.

Related documents:

- `result_envelope_contract.md`
- `artifact_store_contract.md`
- `task_and_workflow_contract.md`
- [ADR-016 OAPEFLIR Eight-Stage Model](../adr/016-oapeflir-loop-model.md)

## 2. Objectives

- Clarify that user-readable results and file artifacts are not the same type of object.
- Unify the boundaries between intermediate structured outputs and final deliverables.
- Provide unified semantics for inspect, replay, download, and retention.
- Support artifact tracking across OAPEFLIR 8 stages (Plan/Execute/Learn/Improve/Rollout).

## 3. Unified Objects

- `HumanOutput`: Conclusions or summaries intended for user display
- `StructuredExecutionView`: Structured intermediate result view derived from `NodeAttemptReceipt`
- `ArtifactRecord`: Physical artifacts such as files, images, reports, and compressed packages

### 3.1 OAPEFLIR ArtifactPlane Interface

```typescript
interface ArtifactRecord {
  artifactId: string;
  harnessRunId: string;
  nodeRunId?: string;
  planGraphBundleId?: string;
  taskId?: string;          // Query entry point, not truth primary key
  executionId?: string;     // legacy projection alias
  type: ArtifactType;
  path: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  refs?: ArtifactRef[];      // Cross-stage references
  publishStatus: PublishStatus;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface ArtifactRef {
  refId: string;
  targetType: 'feedback' | 'learning' | 'improvement' | 'rollout' | 'execution';
  targetId: string;
}
```

## v4.3 Contract Remediation

- T-62: This document originally wrote `executionId / planId / StructuredStepOutput` as artifact primary association keys. Root cause: The artifact contract directly reused the old workflow-step output model without switching to the `NodeAttemptReceipt` and `PlanGraphBundle` execution truth boundaries. Fix: Body now uses `harnessRunId / nodeRunId / planGraphBundleId` as authoritative lineage; old fields are retained only as query compatibility aliases.

### 3.2 ArtifactType Extensions

`ArtifactType` must cover at minimum:

- `report`
- `evidence_bundle`
- `timeline_export`
- `diagnostic_bundle`
- `workflow_checkpoint`
- `feedback_snapshot`
- `learning_object_bundle`         // OAPEFLIR Learn Hub
- `improvement_candidate_bundle`  // OAPEFLIR Improve Hub
- `rollout_evidence`             // OAPEFLIR Rollout
- `policy_explain_export`
- `plan_dag_export`              // OAPEFLIR Plan Hub
- `execution_output`             // OAPEFLIR Execute Hub

`BundleType` must cover at minimum:

- `task_result`
- `incident`
- `promotion_evidence`
- `release_evidence`
- `learning_pattern_bundle`     // OAPEFLIR Learn Hub
- `canary_metrics`              // OAPEFLIR Rollout

`publishStatus` lifecycle:

- `draft`
- `preview`
- `published`
- `archived`

## 4. Rules

- `HumanOutput` may reference artifacts but cannot replace artifact indexes.
- `StructuredStepOutput` is used for downstream step dependencies and should not be directly exposed to users by default.
- `ArtifactRecord` is always accessed through indexes and permission controls, not embedded directly in message bodies.
- When cross closed-loop objects reference artifacts, `ArtifactRef` should be preferred; do not directly embed local paths or blobs.
- Token saving via `ref:artifact:{id}` should be used for Execute-Feedback transfer to reduce token consumption (corresponding to design document §11.4).

## 5. OAPEFLIR Artifact Plane Constraints

- Plan artifacts must be traceable to original assessments and strategies.
- Execute artifacts must include DualChannelStepOutput references.
- Learning artifacts must include evidence links (R4-EVIDENCE constraint).
- Rollout artifacts must include metrics snapshots.
- Artifact 10MB bundle limit and 7-day auto-archival rules (§D.7).

## 6. Closure Conclusion

The key to a unified artifact model is not adding new objects, but ensuring that "text conclusions, structured results, and file artifacts" each occupy their proper place.
