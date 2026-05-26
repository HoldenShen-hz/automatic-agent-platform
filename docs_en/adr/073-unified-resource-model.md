# ADR-073: Unified Agent Resource Model

Status: Accepted (phased)
Date: 2026-04-13
Updated: 2026-04-16

## Background

`reviews/opeli_detailed_design.md §K` requires unifying OAPEFLIR, feedback-learning-improvement closed loop, knowledge and memory references, artifact and rollout evidence chains into a shared resource model.

The repository already contains:

- `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / events / approvals / artifacts / memories` and other persistent objects
- `FeedbackSignal / LearningObject / ImprovementCandidate / StrategyVersion / RolloutRecord` and other domain objects
- `ArtifactRef / EvidenceRef` and similar reference semantics

However, the resource model still has three issues:

1. Incomplete typed refs, `MemoryRef / KnowledgeRef` not explicitly defined in unified resource model.
2. Outdated resource enumeration, not yet incorporating feedback / learning / improvement / rollout / knowledge / memory layer into a single canonical resource family.
3. Old draft directly wrote `EnvironmentSpec / Session / AgentThread / McpServerSpec` as current deliverables, easily confused with Ring 1 completed scope.

Therefore, this ADR needs to be rewritten: first define current authoritative resource boundaries, then separately mark `M2` target-state extensions.

## Decision

The unified resource model adopts a "two-layer definition":

1. Ring 1 authoritative resource family: resource types, typed refs, and lineage boundaries that the current repository and contracts should unifiedly use.
2. Ring 2 / Ring 3 extension resource family: extended resources after complete platformization of `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry`, not counted toward current completion declarations.

## Canonical Typed Ref

All cross-contract shared references converge to typed ref family:

```ts
type TypedRefId = ArtifactRef | EvidenceRef | MemoryRef | KnowledgeRef;

type ArtifactRef = `artifact:${string}`;
type EvidenceRef = `evidence:${string}`;
type MemoryRef = `memory:${string}`;
type KnowledgeRef = `knowledge:${string}`;
```

Constraints:

- `ArtifactRef` is used for previewable, publishable, archivable artifacts in artifact store.
- `EvidenceRef` is used for evidence packages, screenshots, log summaries, repro bundles in runbooks, approvals, audits, and readiness.
- `MemoryRef` is used for persisted entries or promotion records in six-layer memory.
- `KnowledgeRef` is used for knowledge namespaces, knowledge chunks, knowledge entries, or index results.
- If bare `ref_id` appears in a contract, its semantics must converge to one of the four types above; undifferentiated free-form strings must not be used as cross-boundary authoritative references.

## Authoritative Resource Family

Current Ring 1 authoritative resource family:

| Resource Type | Current Canonical Object | Minimal Identifier |
| --- | --- | --- |
| `harness_run` | `HarnessRun` / `harness_runs` | `harness_run_id` |
| `plan_graph_bundle` | `PlanGraphBundle` / `plan_graph_bundles` | `plan_graph_bundle_id` |
| `node_run` | `NodeRun` / `node_runs` | `node_run_id` |
| `node_attempt_receipt` | `NodeAttemptReceipt` / `node_attempt_receipts` | `receipt_id` |
| `task_projection` | `TaskRecord` / `tasks` | `task_id` |
| `workflow_projection` | `WorkflowState` / `workflow_state` | `workflow_id` |
| `approval` | `ApprovalRequest` / `approvals` | `approval_id` |
| `event` | typed event / `events` | `event_id` |
| `artifact` | `ArtifactRecord` | `ArtifactRef` |
| `evidence` | diagnostics / repro / report bundle | `EvidenceRef` |
| `memory_entry` | memory item / promotion record | `MemoryRef` |
| `memory_layer` | `L1-L6` memory partition | `memory_layer + MemoryRef` |
| `feedback_signal` | `FeedbackSignal` | `feedback_signal_id` |
| `learning_object` | `LearningObject` | `learning_object_id` |
| `improvement_candidate` | `ImprovementCandidate` | `improvement_candidate_id` |
| `strategy_version` | `StrategyVersion` | `strategy_version_id` |
| `rollout_record` | `RolloutRecord` | `rollout_record_id` |
| `knowledge_entry` | knowledge item / chunk / summary | `KnowledgeRef` |

Supplementary rules:

- `feedback_signal / learning_object / improvement_candidate / strategy_version / rollout_record` are first-class resources in the OAPEFLIR closed loop, no longer treated as subsidiary logs.
- `memory_layer` is a governance partition of `MemoryEntry`, not an independent business object; but contracts may treat layer promotion as an independent audit resource.
- `knowledge_entry` may exist as minimal implementation in current Ring 1, but naming, references, and lineage semantics must be fixed.

## Resource Projection

The unified resource model does not require the current repository to immediately add a whole new set of tables, but requires all entry documents, contracts, and API descriptions to project to the same resource semantics:

| Resource Family | Common Projections |
| --- | --- |
| harness_run / plan_graph_bundle / node_run / node_attempt_receipt | `storage_schema_contract.md`, `runtime_execution_contract.md` |
| task_projection / workflow_projection | `task_and_workflow_contract.md`, interaction projection |
| approval / event | `approval_and_hitl_contract.md`, `event_bus_contract.md` |
| artifact / evidence | `artifact_store_contract.md`, `diagnostics_snapshot_and_repro_bundle_contract.md` |
| memory_entry / memory_layer | `memory_decay_and_quality_contract.md`, `context_compaction_and_overflow_contract.md` |
| feedback / learning / improvement / rollout | `task_and_workflow_contract.md`, `state_transition_matrix_contract.md` |
| knowledge_entry | knowledge minimum implementation, `data_plane_contract.md`, namespace/ingestion descriptions in active docs |

## Shared Resource Shape

Minimum fields shared across resources should remain consistent:

```ts
interface ResourceEnvelope<Id extends string, Kind extends string> {
  id: Id;
  resourceKind: Kind;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  ownerRef?: string;
  traceId?: string;
  artifactRefs?: ArtifactRef[];
  evidenceRefs?: EvidenceRef[];
  relatedRefIds?: TypedRefId[];
}
```

Description:

- Not requiring all tables to literally adopt the same interface.
- But all contracts should map core entities to the same minimum governance fields: identity, status, timestamps, trace, evidence references, related typed refs.

## Memory And Knowledge Typed Refs

### `MemoryRef`

`MemoryRef` minimally should point to:

- A `MemoryEntry`
- The target entry of a `memory.layer_promoted` event
- A memory object retained or evicted by a `CompactionRecord`

Suggested minimum metadata:

```ts
interface MemoryRefMetadata {
  memoryRef: MemoryRef;
  layer: "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
  scope: "task" | "session" | "project" | "org";
  freshnessState: "fresh" | "aging" | "stale" | "revoked";
}
```

### `KnowledgeRef`

`KnowledgeRef` minimally should point to:

- An entry under some knowledge namespace
- An indexed knowledge chunk / summary / retrieval result
- A provenance record of some knowledge source

Suggested minimum metadata:

```ts
interface KnowledgeRefMetadata {
  knowledgeRef: KnowledgeRef;
  namespace: string;
  trustTier: "authoritative" | "trusted" | "unverified" | "deprecated";
  freshnessState: "fresh" | "aging" | "stale" | "archived";
}
```

## Lineage Principle

The unified resource model must support the following lineage paths:

`HarnessRun/NodeRun/NodeAttemptReceipt -> FeedbackSignal -> LearningObject -> ImprovementCandidate -> StrategyVersion -> RolloutRecord -> Artifact/Evidence`

Also allows:

`HarnessRun/NodeRun -> MemoryRef`

`HarnessRun/NodeRun -> KnowledgeRef`

Constraints:

- Improvement, rollout, and audit chains must not lose upstream feedback / learning sources.
- `MemoryRef` and `KnowledgeRef` may participate in context building, but must not bypass approval, classification, and trust tier boundaries.
- LLM may generate draft content, but resource state transitions must be updated by the control plane.

## Phase Boundary

### Current Ring 1 Authoritative Scope

Current documentation system must be narrated according to the following boundaries:

- `harness_run / plan_graph_bundle / node_run / node_attempt_receipt / approval / event / artifact / evidence / feedback / learning / improvement / rollout / memory / knowledge-minimum` all belong to currently aligned scope.
- `tasks / workflow_state / sessions` only allowed as projection / interaction resource narration.
- Typed ref family is already part of current documentation boundary, even if underlying implementation still has compatible naming.
- `Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release` as top-level loop phases are already current contract canonical terminology.

### `M2` Target-State Scope

The following resources are reserved as `M2-EXT-01` target-state and must not be stated as delivered in current readiness:

- Complete `EnvironmentSpec` platformization
- Complete `Session` / `AgentThread` resource API
- Complete `McpServerSpec` control plane integration
- Complete `Knowledge Plane / Artifact Plane / Domain Registry / Plugin SPI Registry`

These resources may appear in contracts or ADRs, but must be explicitly marked as target-state or extension-plane, not current Ring 1 authoritative deliverable.

## Relationship with Existing Documents

- `storage_schema_contract.md` is responsible for minimal persistence projection, not requiring immediate establishment of all target-state tables.
- `memory_decay_and_quality_contract.md` defines `MemoryRef` and quality, promotion, and decay rules for `L1-L6`.
- `tool_skill_plugin_contract.md` and `ecosystem_extension_plane_contract.md` are responsible for `M2` extension resource SPI / registry boundaries.
- `artifact_unified_model_contract.md` and `artifact_store_contract.md` are responsible for `ArtifactRef` canonical model.

## Result

After adopting this ADR, the meaning of the unified resource model converges to:

1. Current contracts must share the same typed ref and resource family.
2. Ring 1 completed scope and Ring 2 / Ring 3 extension scope are clearly layered.
3. When adding new APIs, table structures, or diagnostic objects, must first project to existing canonical resource family, rather than introducing new parallel naming.

## v4.3 ADR Remediation

- A-20: This ADR originally wrote `tasks / workflow / execution / ExecutionEnvelope` as authoritative resource family. Root cause: unified resource model was first drafted from historical storage projection objects, and was not rewritten synchronized with `HarnessRun / PlanGraphBundle / NodeRun / NodeAttemptReceipt` becoming runtime truth. Fix: Main text now changes canonical resource subject to run/node/graph/receipt, old task/workflow/execution only retained as projection resources.
- A-29: This ADR repeatedly used `phase1-4` as current completion boundary. Root cause: resource model ADR followed old scheduling naming, not synchronized with main architecture's `Ring 1 / Ring 2 / Ring 3` terminology. Fix: Main text now changes to ring layering terminology, old phase names no longer used as canonical delivery scope.