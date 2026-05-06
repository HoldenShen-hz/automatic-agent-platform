# ADR-073: Unified Agent Resource Model

Status: Accepted (phased)
Date: 2026-04-13
Updated: 2026-04-16

## Context

`reviews/opeli_detailed_design.md §K` requires unifying OAPEFLIR, feedback learning improvement loops, knowledge and memory references, and artifact and rollout evidence chains into a single shared resource model.

The repository already contains:

- Persistent objects such as `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / events / approvals / artifacts / memories`
- Domain objects such as `FeedbackSignal / LearningObject / ImprovementCandidate / StrategyVersion / RolloutRecord`
- Reference semantics like `ArtifactRef / EvidenceRef`

However, the resource model still has three issues:

1. Typed refs are incomplete — `MemoryRef / KnowledgeRef` are not explicitly defined in the unified resource model.
2. The resource enumeration is outdated and has not yet incorporated feedback / learning / improvement / rollout / knowledge / memory layers into the same canonical resource family.
3. The old draft directly wrote `EnvironmentSpec / Session / AgentThread / McpServerSpec` as current must-deliver items, which easily creates confusion with the already-completed Ring 1 scope.

Therefore, this ADR needs to be rewritten to: first define the current authoritative resource boundaries, then separately mark the `M2` target-state extensions.

## Decision

The unified resource model adopts a "two-layer definition":

1. Ring 1 authoritative resource family: resource types, typed refs, and lineage boundaries that the current repository and contracts should uniformly use.
2. Ring 2 / Ring 3 extension resource family: extended resources after full platformization of Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry, not counted toward current delivery declarations.

## Canonical Typed Ref

All cross-contract shared references are consolidated into the typed ref family:

```ts
type TypedRefId = ArtifactRef | EvidenceRef | MemoryRef | KnowledgeRef;

type ArtifactRef = `artifact:${string}`;
type EvidenceRef = `evidence:${string}`;
type MemoryRef = `memory:${string}`;
type KnowledgeRef = `knowledge:${string}`;
```

Constraints:

- `ArtifactRef` is used for previewable, publishable, and archivable artifacts in the artifact store.
- `EvidenceRef` is used for evidence packages, screenshots, log summaries, and repro bundles in runbooks, approvals, audits, and readiness.
- `MemoryRef` is used for persisted entries or promotion records in the six-layer memory.
- `KnowledgeRef` is used for knowledge namespaces, knowledge chunks, knowledge entries, or retrieval results.
- If a bare `ref_id` appears in a contract, its semantics must be resolvable to one of the four types above; undifferentiated free-form strings must no longer be used as cross-boundary authoritative references.

## Authoritative Resource Family

The current Ring 1 authoritative resource family is as follows:

| Resource Type | Current Canonical Object | Minimum Identifier |
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

- `feedback_signal / learning_object / improvement_candidate / strategy_version / rollout_record` are first-class resources in the OAPEFLIR loop and are no longer treated as subordinate logs.
- `memory_layer` is a governance partition of `MemoryEntry`, not an independent business object; however, contracts may treat layer promotion as an independent audit resource.
- `knowledge_entry` may exist with a minimal implementation in the current Ring 1, but naming, references, and lineage semantics must be fixed.

## Resource Projection

The unified resource model does not require the current repository to immediately add an entirely new set of tables, but all entry documents, contracts, and API descriptions must project to the same set of resource semantics:

| Resource Family | Current Common Projections |
| --- | --- |
| harness_run / plan_graph_bundle / node_run / node_attempt_receipt | `storage_schema_contract.md`, `runtime_execution_contract.md` |
| task_projection / workflow_projection | `task_and_workflow_contract.md`, interaction projection |
| approval / event | `approval_and_hitl_contract.md`, `event_bus_contract.md` |
| artifact / evidence | `artifact_store_contract.md`, `diagnostics_snapshot_and_repro_bundle_contract.md` |
| memory_entry / memory_layer | `memory_decay_and_quality_contract.md`, `context_compaction_and_overflow_contract.md` |
| feedback / learning / improvement / rollout | `task_and_workflow_contract.md`, `state_transition_matrix_contract.md` |
| knowledge_entry | `knowledge` minimal implementation, `data_plane_contract.md`, namespace/ingestion descriptions in active docs |

## Shared Resource Shape

The minimum fields shared across resources should remain consistent:

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

Note:

- Not all tables are required to literally adopt the same interface.
- However, all contracts must be able to map core entities to the same set of minimum governance fields: identity, status, timestamps, trace, evidence references, and related typed refs.

## Memory And Knowledge Typed Refs

### `MemoryRef`

`MemoryRef` must minimally be able to reference:

- A `MemoryEntry`
- The target entry of a `memory.layer_promoted` event
- A retained or evicted memory object from a `CompactionRecord`

Minimum metadata suggestion:

```ts
interface MemoryRefMetadata {
  memoryRef: MemoryRef;
  layer: "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
  scope: "task" | "session" | "project" | "org";
  freshnessState: "fresh" | "aging" | "stale" | "revoked";
}
```

### `KnowledgeRef`

`KnowledgeRef` must minimally be able to reference:

- An entry under a knowledge namespace
- An indexed knowledge chunk / summary / retrieval result
- A provenance record of a knowledge source

Minimum metadata suggestion:

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

While also allowing:

`HarnessRun/NodeRun -> MemoryRef`

`HarnessRun/NodeRun -> KnowledgeRef`

Constraints:

- Improvement, release, and audit chains must not lose upstream feedback / learning sources.
- `MemoryRef` and `KnowledgeRef` may participate in context construction but must not bypass approval, classification, and trust tier boundaries.
- LLMs may generate draft content, but resource state transitions must be updated by the control plane.

## Phase Boundary

### Current Ring 1 Authoritative Scope

The current document system must describe according to the following boundaries:

- `harness_run / plan_graph_bundle / node_run / node_attempt_receipt / approval / event / artifact / evidence / feedback / learning / improvement / rollout / memory / knowledge-minimum` all belong to the currently aligned scope.
- `tasks / workflow_state / sessions` are only allowed as projection / interaction resource narratives.
- The typed ref family is already part of the current document boundaries, even if the underlying implementation still has compatible naming.
- `Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release` as top-level loop stages are already current contract canonical terminology.

### `M2` Target-State Scope

The following resources are reserved as `M2-EXT-01` target-state and must not be stated as delivered in current readiness:

- Full `EnvironmentSpec` platformization
- Full `Session` / `AgentThread` resource APIs
- Full `McpServerSpec` control plane integration
- Full `Knowledge Plane / Artifact Plane / Domain Registry / Plugin SPI Registry`

These resources may appear in contracts or ADRs but must be explicitly marked as target-state or extension-plane, not as current Ring 1 authoritative deliverables.

## Relationship with Existing Documents

- `storage_schema_contract.md` is responsible for minimal persistence projections and does not require immediately establishing all target-state tables.
- `memory_decay_and_quality_contract.md` defines `MemoryRef` and quality, promotion, and decay rules for `L1-L6`.
- `tool_skill_plugin_contract.md` and `ecosystem_extension_plane_contract.md` are responsible for `M2` extended resource SPI / registry boundaries.
- `artifact_unified_model_contract.md` and `artifact_store_contract.md` are responsible for the `ArtifactRef` canonical model.

## Result

After adopting this ADR, the meaning of the unified resource model is consolidated as:

1. Current contracts must share the same typed ref and resource family.
2. Ring 1 completed scope and Ring 2 / Ring 3 extended scope are explicitly layered.
3. When adding new APIs, table structures, or diagnostic objects in the future, they must first project to existing canonical resource families rather than introducing new parallel naming.

## v4.3 ADR Remediation

- A-20: This ADR originally listed `tasks / workflow / execution / ExecutionEnvelope` as authoritative resource family. Root cause: The unified resource model was first drafted from historical storage projection objects, then was not rewritten when `HarnessRun / PlanGraphBundle / NodeRun / NodeAttemptReceipt` became runtime truth. Fix: The canonical resource subject is now changed to run/node/graph/receipt in the main text; old task/workflow/execution are retained only as projection resources.
- A-29: This ADR repeatedly used `phase1-4` as the current completion boundary. Root cause: The resource model ADR followed old scheduling naming and was not updated along with the main architecture's unification to `Ring 1 / Ring 2 / Ring 3`. Fix