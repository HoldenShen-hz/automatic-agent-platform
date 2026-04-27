# Artifact Unified Model Contract

> **OAPEFLIR Related**: This contract defines the unified model for OAPEFLIR Artifact Plane, corresponding to ADR-016 §11.
> **Updated**: 2026-04-17

## 1. Scope

This contract unifies three types of result expressions: `output`, `step output`, and `artifact`, avoiding mixing text results, structured results, and file artifacts.

Related Documents:

- `result_envelope_contract.md`
- `artifact_store_contract.md`
- `task_and_workflow_contract.md`
- [ADR-016 OAPEFLIR Eight-Phase Model](../adr/016-oapeflir-loop-model.md)

## 2. Goals

- Clarify that user-readable results and file artifacts are not the same type of object.
- Unify boundaries between intermediate structured output and final deliverables.
- Provide unified semantics for inspect, replay, download, and retention.
- Support OAPEFLIR 8-phase artifact tracking (Plan/Execute/Learn/Improve/Rollout).

## 3. Unified Objects

- `HumanOutput`: Conclusions or summaries displayed to users
- `StructuredStepOutput`: Structured intermediate results of workflow / step (corresponding to OAPEFLIR Execute DualChannelStepOutput)
- `ArtifactRecord`: Physical artifacts such as files, images, reports, compressed packages

### 3.1 OAPEFLIR ArtifactPlane Interface

```typescript
interface ArtifactRecord {
  artifactId: string;
  taskId: string;
  executionId?: string;
  planId?: string;          // OAPEFLIR Plan Hub
  type: ArtifactType;
  path: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  refs?: ArtifactRef[];      // Cross-phase references
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

### 3.2 ArtifactType Extension

`ArtifactType` should currently cover at least:

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

`BundleType` should currently cover at least:

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

- `HumanOutput` can reference artifacts but cannot replace artifact index.
- `StructuredStepOutput` is used for subsequent step dependencies and should not be directly exposed to users by default.
- `ArtifactRecord` all access through index and permission control, not directly stuffed into message body.
- When cross-closed-loop objects reference artifacts, should prioritize using `ArtifactRef`, not directly embedding local paths or blobs.
- Token saving via `ref:artifact:{id}` should be used for Execute→Feedback delivery to reduce token consumption (corresponding to design document §11.4).

## 5. OAPEFLIR Artifact Plane Constraints

- Plan artifacts must be traceable to original assessment and strategy.
- Execute artifacts must include DualChannelStepOutput reference.
- Learning artifacts must include evidence links (R4-EVIDENCE constraint).
- Rollout artifacts must include metrics snapshots.
- Artifact 10MB bundle limit and 7-day auto-archive rules (§D.7).

## 6. Closure Conclusion

The key to unified artifact model is not adding new objects, but letting "text conclusions, structured results, file artifacts" each find their proper place.
