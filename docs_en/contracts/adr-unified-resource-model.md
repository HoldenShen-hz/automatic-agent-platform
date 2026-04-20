# ADR-073: Unified Agent Resource Model

Status: Accepted (phased)
Date: 2026-04-13
Updated: 2026-04-16

## Background

`reviews/opeli_detailed_design.md §K` requires unifying OAPEFLIR, feedback learning improvement loop, knowledge and memory references, artifact and rollout evidence chains into a shared resource model.

The repository previously contained:

- `tasks / workflow_state / executions / events / approvals / artifacts / memories` and other persistent objects
- `FeedbackSignal / LearningObject / ImprovementCandidate / StrategyVersion / RolloutRecord` and other domain objects
- `ArtifactRef / EvidenceRef` and similar reference semantics

However, the resource model still has three issues:

1. Typed refs are incomplete; `MemoryRef / KnowledgeRef` are not clearly defined in the unified resource model.
2. Resource enumeration is outdated; feedback / learning / improvement / rollout / knowledge / memory layers have not been incorporated into the same canonical resource family.
3. Old drafts directly specify `EnvironmentSpec / Session / AgentThread / McpServerSpec` as current deliverables, easily confusing with completed phase1-4 scope.

Therefore, this ADR needs to be rewritten to: first provide the current authoritative resource boundaries, then separately mark `M2` target-state extensions.

## Decision

The unified resource model adopts a "two-layer definition":

1. phase1-4 authoritative resource family: resource types, typed refs, and lineage boundaries that the current repository and contracts should uniformly use.
2. `M2` target-state resource family: extended resources after complete platformization of Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry, not counted toward current completion declarations.

## Canonical Typed Ref

All cross-contract shared references converge to the typed ref family:

```ts
type TypedRefId = ArtifactRef | EvidenceRef | MemoryRef | KnowledgeRef;

type ArtifactRef = `artifact:${string}`;
type EvidenceRef = `evidence:${string}`;
type MemoryRef = `memory:${string}`;
type KnowledgeRef = `knowledge:${string}`;
```

Constraints:

- `ArtifactRef` is used for previewable, publishable, archivable artifacts in the artifact store.
- `EvidenceRef` is used for evidence packages, screenshots, log summaries, and repro bundles in runbooks, approvals, audits, and readiness.
- `MemoryRef` is used for persisted entries or promotion records in the six-layer memory.
- `KnowledgeRef` is used for knowledge namespace, knowledge chunks, knowledge entries, or index results.
- If a bare `ref_id` appears in a contract, its semantics must converge to one of the above four types; untyped free-form strings must not be used as cross-boundary authoritative references.

## Authoritative Resource Family

Current phase1-4 authoritative resource family is as follows:

| Resource Type | Current Canonical Object | Minimum Identifier |
| --- | --- | --- |
| `task` | `TaskRecord` / `tasks` | `task_id` |
| `workflow` | `WorkflowState` / `workflow_state` | `workflow_id` |
| `execution` | `ExecutionEnvelope` / `executions` | `execution_id` |
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

Supplementary Rules:

- `feedback_signal / learning_object / improvement_candidate / strategy_version / rollout_record` are first-class resources in the OAPEFLIR loop, no longer just auxiliary logs.
- `memory_layer` is a governance partition of `MemoryEntry`, not an independent business object; but contracts may treat layer promotion as an independent audit resource.
- `knowledge_entry` is allowed to exist with minimal implementation in current phase1-4, but naming, references, and lineage semantics must be fixed.

## Resource Projection

The unified resource model does not require the current repository to immediately create a whole new set of tables; it requires that all entry documents, contracts, and API narratives can project to the same set of resource semantics:

| Resource Family | Current Common Projections |
| --- | --- |
| task / workflow / execution | `storage_schema_contract.md`, `runtime_execution_contract.md` |
| approval / event | `approval_and_hitl_contract.md`, `event_bus_contract.md` |
| artifact / evidence | `artifact_store_contract.md`, `diagnostics_snapshot_and_repro_bundle_contract.md` |
| memory_entry / memory_layer | `memory_decay_and_quality_contract.md`, `context_compaction_and_overflow_contract.md` |
| feedback / learning / improvement / rollout | `task_and_workflow_contract.md`, `state_transition_matrix_contract.md` |
| knowledge_entry | `knowledge` minimum implementation, `data_plane_contract.md`, active docs namespace/ingestion descriptions |

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

Explanation:

- Not all tables must adopt the same interface verbatim.
- But all contracts should be able to map core entities to the same set of minimum governance fields: identity, status, time, trace, evidence references, and related typed refs.

## Memory And Knowledge Typed Refs

### `MemoryRef`

`MemoryRef` should minimally point to:

- A certain `MemoryEntry`
- The target entry of a `memory.layer_promoted` event
- A memory object retained or evicted by a `CompactionRecord`

Minimum metadata recommendations:

```ts
interface MemoryRefMetadata {
  memoryRef: MemoryRef;
  layer: "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
  scope: "task" | "session" | "project" | "org";
  freshnessState: "fresh" | "aging" | "stale" | "revoked";
}
```

### `KnowledgeRef`

`KnowledgeRef` should minimally point to:

- An entry under a knowledge namespace
- An indexed knowledge chunk / summary / retrieval result
- A provenance record of a knowledge source

Minimum metadata recommendations:

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

`Task/Workflow/Execution -> FeedbackSignal -> LearningObject -> ImprovementCandidate -> StrategyVersion -> RolloutRecord -> Artifact/Evidence`

And also allow:

`Task/Execution -> MemoryRef`

`Task/Execution -> KnowledgeRef`

Constraints:

- Improvement, release, and audit chains must not lose upstream feedback / learning sources.
- `MemoryRef` and `KnowledgeRef` can participate in context construction but cannot bypass approval, classification, and trust tier boundaries.
- LLMs can generate draft content, but resource state transitions must be updated by the control plane.

## Phase Boundary

### Current phase1-4 Authoritative Scope

Current document system must describe according to the following boundaries:

- `tasks / workflow / execution / approval / event / artifact / evidence / feedback / learning / improvement / rollout / memory / knowledge-minimum` all belong to the current aligned scope.
- Typed ref family is already part of current document boundaries, even if underlying implementation still has compatibility naming.
- `Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release` as top-level loop stages are already current contract canonical terminology.

### `M2` Target-State Scope

The following resources are reserved as `M2-EXT-01` target-state and must not be described as delivered in current readiness:

- Complete `EnvironmentSpec` platformization
- Complete `Session` / `AgentThread` resource API
- Complete `McpServerSpec` control plane
- Complete `Knowledge Plane / Artifact Plane / Domain Registry / Plugin SPI Registry`

These resources may appear in contracts or ADRs but must be explicitly marked as target-state or extension-plane, not current phase1-4 authoritative deliverable.

## Relationship with Existing Documents

- `storage_schema_contract.md` is responsible for minimum persistence projection, not requiring immediate establishment of all target-state tables.
- `memory_decay_and_quality_contract.md` defines `MemoryRef` and `L1-L6` quality, promotion, and decay rules.
- `tool_skill_plugin_contract.md` and `ecosystem_extension_plane_contract.md` are responsible for `M2` extended resource SPI / registry boundaries.
- `artifact_unified_model_contract.md` and `artifact_store_contract.md` are responsible for `ArtifactRef` canonical model.

## Result

After adopting this ADR, the meaning of the unified resource model converges to:

1. Current contracts must share the same typed ref and resource family.
2. phase1-4 completed scope and `M2` extended scope are explicitly layered.
3. When adding new APIs, table structures, or diagnostic objects, they must first project to existing canonical resource family, rather than introducing new parallel naming.
