# ADR-073: Unified Agent Resource Model

Status: Accepted (phased)
Date: 2026-04-13
Updated: 2026-04-16

## Context

`reviews/opeli_detailed_design.md §K` requires unifying OAPEFLIR, feedback learning improvement loop, knowledge and memory references, and artifact and rollout evidence chains into a single shared resource model.

The repository already contains:

- Persistent objects such as `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / events / approvals / artifacts / memories`
- Domain objects such as `FeedbackSignal / LearningObject / ImprovementCandidate / StrategyVersion / RolloutRecord`
- Reference semantics such as `ArtifactRef / EvidenceRef`

However, the resource model still has three problems:

1. Typed refs are incomplete; `MemoryRef / KnowledgeRef` are not explicitly defined in the unified resource model.
2. The resource enumeration is outdated, not yet incorporating feedback / learning / improvement / rollout / knowledge / memory layers into the same canonical resource family.
3. The old draft directly specified `EnvironmentSpec / Session / AgentThread / McpServerSpec` as current must-deliver, which easily conflates with completed Ring 1 scope.

Therefore, this ADR needs to be rewritten: first define the current authoritative resource boundaries, then separately mark the `M2` target-state extensions.

## Decision

The unified resource model adopts a "two-layer definition":

1. Ring 1 authoritative resource family: resource types, typed refs, and lineage boundaries that the current repository and contracts should uniformly use.
2. Ring 2 / Ring 3 extension resource family: extended resources after full platformization of Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry; not counted toward current completion claims.

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

- `ArtifactRef` is used for artifact store artifacts that are previewable, publishable, and archivable.
- `EvidenceRef` is used for evidence packages, screenshots, log summaries, and repro bundles in runbooks, approvals, audits, and readiness.
- `MemoryRef` is used for persisted entries or promotion records in the six-layer memory.
- `KnowledgeRef` is used for knowledge namespaces, knowledge chunks, knowledge entries, or retrieval results.
- If a bare `ref_id` appears in contracts, its semantics must converge to one of the above four types; undifferentiated free-form strings must not be used as cross-boundary authoritative references.

## Authoritative Resource Family

Current Ring 1 authoritative resource family is as follows:

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

- `feedback_signal / learning_object / improvement_candidate / strategy_version / rollout_record` are first-class resources in the OAPEFLIR loop and are no longer treated as subsidiary logs.
- `memory_layer` is a governance partition of `MemoryEntry`, not an independent business object; however, contracts may treat layer promotion as an independent audit resource.
- `knowledge_entry` is allowed to exist with minimal implementation in current Ring 1, but naming, references, and lineage semantics must be fixed.

## Resource Projection

The unified resource model does not require the current repository to immediately add a whole new set of tables, but requires that all entry documents, contracts, and API descriptions can be projected to the same set of resource semantics:

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

Notes:

- Not all tables are required to adopt the exact same interface verbatim.
- However, all contracts should be able to map core entities to the same set of minimum governance fields: identity, status, timestamps, trace, evidence references, and related typed refs.

## Memory And Knowledge Typed Refs

### `MemoryRef`

`MemoryRef` should minimally be able to point to:

- A `MemoryEntry`
- The target entry of a `memory.layer_promoted` event
- A retained or evicted memory object in a `CompactionRecord`

Minimum metadata recommendation:

```ts
interface MemoryRefMetadata {
  memoryRef: MemoryRef;
  layer: "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
  scope: "task" | "session" | "project" | "org";
  freshnessState: "fresh" | "aging" | "stale" | "revoked";
}
```

### `KnowledgeRef`

`KnowledgeRef` should minimally be able to point to:

- An entry under a knowledge namespace
- An indexed knowledge chunk / summary / retrieval result
- A provenance record for a knowledge source

Minimum metadata recommendation:

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

And also allow:

`HarnessRun/NodeRun -> MemoryRef`

`HarnessRun/NodeRun -> KnowledgeRef`

Constraints:

- Improvement, release, and audit chains must not lose upstream feedback / learning sources.
- `MemoryRef` and `KnowledgeRef` may participate in context construction but must not bypass approval, classification, and trust tier boundaries.
- LLMs may generate draft content, but resource state transitions must be updated by the control plane.

## Phase Boundary

### Current Ring 1 Authoritative Scope

Current documentation must describe the following boundaries:

- `harness_run / plan_graph_bundle / node_run / node_attempt_receipt / approval / event / artifact / evidence / feedback / learning / improvement / rollout / memory / knowledge-minimum` all belong to the current aligned scope.
- `tasks / workflow_state / sessions` are only permitted as projection / interaction resource descriptions.
- Typed ref family is already part of current documentation boundaries, even if underlying implementations still have legacy naming.
- `Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release` as top-level loop phases are already current contract canonical terminology.

### `M2` Target-State Scope

The following resources are reserved as `M2-EXT-01` target-state and must not be stated as delivered in current readiness:

- Full `EnvironmentSpec` platformization
- Full `Session` / `AgentThread` resource-oriented API
- Full `McpServerSpec` control plane integration
- Full `Knowledge Plane / Artifact Plane / Domain Registry / Plugin SPI Registry`

These resources may appear in contracts or ADRs but must be explicitly marked as target-state or extension-plane, not current Ring 1 authoritative deliverable.

## Relationship with Existing Documents

- `storage_schema_contract.md` is responsible for minimal persistence projections, not requiring immediate establishment of all target-state tables.
- `memory_decay_and_quality_contract.md` defines `MemoryRef` and quality, promotion, and decay rules for `L1-L6`.
- `tool_skill_plugin_contract.md` and `ecosystem_extension_plane_contract.md` are responsible for `M2` extension resource SPI / registry boundaries.
- `artifact_unified_model_contract.md` and `artifact_store_contract.md` are responsible for the canonical model of `ArtifactRef`.

## Result

After adopting this ADR, the meaning of the unified resource model is converged to:

1. Current contracts must share the same typed ref and resource family.
2. Ring 1 completed scope and Ring 2 / Ring 3 extension scope are explicitly layered.
3. When adding new APIs, table structures, or diagnostic objects in the future, they must first project to existing canonical resource families, rather than introducing new parallel naming.

## v4.3 ADR Remediation

- A-20: This ADR originally wrote `tasks / workflow / execution / ExecutionEnvelope` as the authoritative resource family. The root cause was that the unified resource model was first drafted from historical storage projection objects and was not subsequently rewritten as `HarnessRun / PlanGraphBundle / NodeRun / NodeAttemptReceipt` became runtime truth. Fix: The main text now changes the canonical resource subject to run/node/graph/receipt; old task/workflow/execution are retained only as projection resources.
- A-29: This ADR originally repeatedly used `phase1-4` as the current completion boundary. The root cause was that the resource model ADR followed legacy scheduling naming and was not synchronized with the main architecture's migration to `Ring 1 / Ring 2 / Ring 3`. Fix: The main text now uses ring layering terminology; old phase names are no longer used as canonical delivery language.