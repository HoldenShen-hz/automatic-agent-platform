# Artifact Unified Model Contract

> **OAPEFLIR Association**: This contract defines the OAPEFLIR Artifact Plane unified model, corresponding to ADR-016 §11.
> **Update Date**: 2026-04-17

## 1. Scope

This contract unifies `output`, `step output`, and `artifact` three types of result expressions, avoiding mixing text results, structured results, and file artifacts.

Related documents:

- `result_envelope_contract.md`
- `artifact_store_contract.md`
- `task_and_workflow_contract.md`
- [ADR-016 OAPEFLIR 8-Stage Model](../adr/016-oapeflir-loop-model.md)

## 2. Goals

- Clarify that user-readable results and file artifacts are not the same type of object.
- Unify boundaries between intermediate structured output and final deliverables.
- Provide unified semantics for inspect, replay, download, and retention.
- Support artifact tracking across OAPEFLIR 8 stages (Plan/Execute/Learn/Improve/Rollout).

## 3. Unified Objects

- `HumanOutput`: User-facing conclusions or summaries
- `StructuredExecutionView`: Structured intermediate result view derived from `NodeAttemptReceipt`
- `ArtifactRecord`: Physical artifacts such as files, images, reports, compressed packages

### 3.1 OAPEFLIR ArtifactPlane Interface

```typescript
interface ArtifactRecord {
  artifactId: string;
  harnessRunId: string;
  nodeRunId?: string;
  planGraphBundleId?: string;
  taskId?: string;          // Query entry, not truth primary key
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

- T-62: This document previously used `executionId / planId / StructuredStepOutput` as artifact primary association key. The root cause was that artifact contract directly reused old workflow-step output model and did not switch to `NodeAttemptReceipt` and `PlanGraphBundle` execution truth boundary. Fix: The text now uses `harnessRunId / nodeRunId / planGraphBundleId` as authoritative lineage; old fields only retain as query-compatible aliases.

### 3.2 ArtifactType Extensions

`ArtifactType` current at least should cover:

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

`BundleType` current at least should cover:

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

- `HumanOutput` can reference artifacts, but cannot replace artifact index.
- `StructuredStepOutput` is used for subsequent step dependencies; it should not be directly exposed to users by default.
- `ArtifactRecord` is always accessed through index and permission control; it is not directly put into message body.
- When cross-closed-loop object references artifact, `ArtifactRef` should be prioritized; embedding local paths or blobs directly is not allowed.
- Token saving via `ref:artifact:{id}` should be used in Execute→Feedback delivery to reduce token consumption (corresponding to design document §11.4).

## 5. OAPEFLIR Artifact Plane Constraints

- Plan artifact must be traceable to original assessment and strategy.
- Execute artifact must include DualChannelStepOutput reference.
- Learning artifact must include evidence link (R4-EVIDENCE constraint).
- Rollout artifact must include metrics snapshot.
- Artifact 10MB bundle limit and 7-day auto-archive rule (§D.7).

## 6. Closure Conclusion

The key to unified artifact model is not adding new objects, but letting "text conclusions, structured results, file artifacts" each fall into their proper place.