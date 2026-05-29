# ADR-073: Unified Agent Resource Model

Status: Accepted (phased)
Date: 2026-04-13
Updated: 2026-04-16

## Background

`reviews/opeli_detailed_design.md §K` requires unifying OAPEFLIR, feedback learning improvement loop, knowledge and memory references, artifact and rollout evidence chains into one shared resource model.

Previously the repository already had:

- `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / events / approvals / artifacts / memories` etc. persistent objects
- `FeedbackSignal / LearningObject / ImprovementCandidate / StrategyVersion / RolloutRecord` etc. domain objects
- `ArtifactRef / EvidenceRef` reference semantics

But the resource model still had three problems:

1. Typed ref incomplete, `MemoryRef / KnowledgeRef` not explicitly in unified resource model.
2. Resource enum outdated, not yet incorporating feedback / learning / improvement / rollout / knowledge / memory layer into same canonical resource family.
3. Old draft directly wrote `EnvironmentSpec / Session / AgentThread / McpServerSpec` as current must-deliver, easily confused with Ring 1 completed scope.

Therefore this ADR needs to be rewritten: first give current authoritative resource boundaries, then separately mark `M2` target-state extensions.

## Decision

Unified resource model adopts "two-layer definition":

1. Ring 1 authoritative resource family: Resource types, typed refs and lineage boundaries that current repository and contract should uniformly use.
2. Ring 2 / Ring 3 extension resource family: Extended resources after `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` complete platformization, not counted toward current completion declaration.

## Canonical Typed Ref

All cross-contract shared references uniformly converge to typed ref family:

```ts
type TypedRefId = ArtifactRef | EvidenceRef | MemoryRef | KnowledgeRef;

type ArtifactRef = `artifact:${string}`;
type EvidenceRef = `evidence:${string}`;
type MemoryRef = `memory:${string}`;
type KnowledgeRef = `knowledge:${string}`;
```

Constraints:

- `ArtifactRef` used for previewable, publishable, archivable products in artifact store.
- `EvidenceRef` used for evidence packages, screenshots, log summaries, repro bundles in runbooks, approvals, audits, readiness.
- `MemoryRef` used for persisted entries or promotion records in six-layer memory.
- `KnowledgeRef` used for knowledge namespace, knowledge chunks, knowledge entries or index results.
- If bare `ref_id` appears in contract, semantics must converge to one of the above four types; must not use untyped free-form string as cross-boundary authoritative reference.

## Authoritative Resource Family

Current Ring 1 authoritative resource family as follows:

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

- `feedback_signal / learning_object / improvement_candidate / strategy_version / rollout_record` are first-class resources in OAPEFLIR closed loop, no longer just considered附属logs.
- `memory_layer` is governance partition of `MemoryEntry`, not independent business object; but contract allows treating layer promotion as independent audit resource.
- `knowledge_entry` allowed to exist in minimal implementation in current Ring 1, but naming, references and lineage semantics must be fixed.

## Resource Projection

Unified resource model does not require current repository to immediately add a whole new set of tables, but requires all entry documents, contracts and API narratives to project to same resource semantics:

| Resource Family | Current Common Projections |
| --- | --- |
| harness_run / plan_graph_bundle / node_run / node_attempt_receipt | `storage_schema_contract.md`, `runtime_execution_contract.md` |
| task_projection / workflow_projection | `task_and_workflow_contract.md`, interaction projection |
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

- Not requiring all tables to literally adopt same interface.
- But all contracts should be able to map core entities to same minimum governance fields: identity, status, time, trace, evidence references, related typed refs.

## Memory And Knowledge Typed Refs

### `MemoryRef`

`MemoryRef` minimum should point to:

- A certain `MemoryEntry`
- A certain `memory.layer_promoted` event target entry
- A certain `CompactionRecord` retained or evicted memory object

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

`KnowledgeRef` minimum should point to:

- An entry under some knowledge namespace
- An indexed knowledge chunk / summary / retrieval result
- A provenance record of some knowledge source

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

Unified resource model must support following lineage paths:

`HarnessRun/NodeRun/NodeAttemptReceipt -> FeedbackSignal -> LearningObject -> ImprovementCandidate -> StrategyVersion -> RolloutRecord -> Artifact/Evidence`

Also allows:

`HarnessRun/NodeRun -> MemoryRef`

`HarnessRun/NodeRun -> KnowledgeRef`

Constraints:

- Improvement, release and audit chains must not lose upstream feedback / learning sources.
- `MemoryRef` and `KnowledgeRef` can participate in context construction, but cannot bypass approval, classification and trust tier boundaries.
- LLM can generate draft content, but resource state transitions must be updated by control plane.

## Phase Boundary

### Current Ring 1 Authoritative Scope

Current document system must narrate according to following boundaries:

- `harness_run / plan_graph_bundle / node_run / node_attempt_receipt / approval / event / artifact / evidence / feedback / learning / improvement / rollout / memory / knowledge-minimum` all belong to current aligned scope.
- `tasks / workflow_state / sessions` only allowed as projection / interaction resource narrations.
- Typed ref family is already part of current document boundary, even if underlying implementation still has compatible naming.
- `Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release` as top-level loop stages is already current contract canonical terminology.

### `M2` Target-state Scope

Following resources reserved as `M2-EXT-01` target-state, must not be narrated as currently delivered in readiness:

- Complete `EnvironmentSpec` platformization
- Complete `Session` / `AgentThread` resource-ized API
- Complete `McpServerSpec` control-plane integration
- Complete `Knowledge Plane / Artifact Plane / Domain Registry / Plugin SPI Registry`

These resources can appear in contracts or ADRs, but must be explicitly marked as target-state or extension-plane, not current Ring 1 authoritative deliverable.

## Relationship with Existing Documents

- `storage_schema_contract.md` responsible for minimum persistent projection, not requiring immediately establishing all target-state tables.
- `memory_decay_and_quality_contract.md` defines `MemoryRef` and `L1-L6` quality, promotion and decay rules.
- `tool_skill_plugin_contract.md` and `ecosystem_extension_plane_contract.md` responsible for `M2` extension resource SPI / registry boundaries.
- `artifact_unified_model_contract.md` and `artifact_store_contract.md` responsible for `ArtifactRef` canonical model.

## Result

After adopting this ADR, the meaning of unified resource model is converged to:

1. Current contracts must share same set of typed refs and resource family.
2. Ring 1 completed scope and Ring 2 / Ring 3 extended scope are explicitly layered.
3. When adding new APIs, table structures or diagnostic objects in the future, must prioritize projecting to existing canonical resource family, not introducing new parallel naming.

## v4.3 ADR Remediation

- A-20: This ADR originally wrote `tasks / workflow / execution / ExecutionEnvelope` as authoritative resource family, root cause being unified resource model first drafted from historical storage projection objects, later not updated with `HarnessRun / PlanGraphBundle / NodeRun / NodeAttemptReceipt` becoming runtime truth sync rewrite. Fix: Body now changes canonical resource subject to run/node/graph/receipt, old task/workflow/execution only retained as projection resource.
- A-29: This ADR repeatedly used `phase1-4` as current completion boundary, root cause being resource model ADR followed old scheduling naming, not updated with main architecture unified to `Ring 1 / Ring 2 / Ring 3`. Fix: Body now changed to ring layering terminology, old phase names no longer used as canonical delivery口径.