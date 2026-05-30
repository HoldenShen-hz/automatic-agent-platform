# v4.3 Plan Graph And Patch Contract

> v4.3 canonical contract. Covers `PlanGraphBundle` / `PlanGraph` / `PlanNode` / `PlanEdge` / `GraphPatch` / `GraphPatchOperation`.

## 1. Scope

`PlanGraphBundle` is the sole execution plan contract from P3 to P4. All tasks, including simple tasks, must be dispatched in graph form; simple tasks degenerate to single-node graphs. `ExecutionPlan` is only allowed as a deprecated alias.

## 2. PlanGraphBundle Minimal Fields

| Field | Type | Description |
|---|---|---|
| `planGraphBundleId` | `string` | bundle ID |
| `harnessRunId` | `string` | owning run |
| `graphVersion` | `number` | graph version |
| `graph` | `PlanGraph` | graph structure |
| `schedulerPolicy` | `ReadyNodeSchedulingPolicy` | scheduling policy |
| `budget` | `BudgetPlanRef` | budget plan reference |
| `riskProfile` | `RiskProfile` | graph-level risk |
| `validationReport` | `GraphValidationReport` | graph validation report |
| `artifactRefs` | `ArtifactRef[]` | large object references |
| `createdAt` | `timestamp` | creation time |

## 3. PlanGraph / PlanNode / PlanEdge

`PlanGraph` minimal fields:

- `graphId`
- `nodes`
- `edges`
- `entryNodeIds`
- `terminalNodeIds`
- `joinStrategy`
- `graphHash`

`PlanNode` minimal fields:

- `nodeId`
- `nodeType` (`tool | llm | hitl_wait | subgraph | evaluator | router | compensation`)
- `inputRefs`
- `outputSchemaRef`
- `riskClass`
- `budgetIntent`
- `sideEffectProfile`
- `retryPolicyRef`
- `timeoutMs`

`PlanEdge` minimal fields:

- `edgeId`
- `fromNodeId`
- `toNodeId`
- `condition`
- `dependencyType` (`hard | soft | compensation | retry | replan`)

## 4. Immutability Constraints

- `PlanGraphBundle` is an immutable snapshot; once dispatched to P4, `nodes` / `edges` / `schedulerPolicy` / `riskProfile` corresponding to `graphVersion` must not be modified in place.
- Canonical contract prohibits rewriting existing `PlanGraph` via `appendNode`, `removeNode`, `updateNode`, or any in-place mutate API.
- Any semantic change must be expressed as `GraphPatch(baseGraphVersion -> newGraphVersion)`, generating a new snapshot version.
- Executed nodes, nodes with `NodeAttemptReceipt`, and paths with confirmed side effect associations can only be handled by appending compensation or appending repair paths; historical graphs must not be overwritten.

## 5. GraphPatch

Replan does not overwrite old graphs; it only appends `GraphPatch`:

```text
PlanGraph(v1) + GraphPatch(v2 operations) -> PlanGraph(v2)
```

Minimal fields:

| Field | Type | Description |
|---|---|---|
| `graphPatchId` | `string` | patch ID |
| `harnessRunId` | `string` | owning run |
| `baseGraphVersion` | `number` | base version |
| `newGraphVersion` | `number` | new version |
| `operations` | `GraphPatchOperation[]` | closed operations |
| `affectedExecutedNodes` | `string[]` | affected executed nodes |
| `affectedSideEffects` | `string[]` | affected side effects |
| `compatibilityClass` | `safe_append \| requires_checkpoint_revalidation \| requires_human_approval \| incompatible_restart_required` | compatibility class |
| `compensationPlanRef` | `ArtifactRef?` | necessary compensation plan |
| `policyProofRef` | `ArtifactRef` | policy proof |
| `auditRef` | `ArtifactRef` | audit reference |

`GraphPatchOperation` is a closed enumeration:

- `add_node`
- `add_edge`
- `disable_edge`
- `add_compensation_node`
- `add_failure_path`
- `mark_skipped`
- `append_subgraph`

## 6. Safety Rules

- Semantics of completed nodes, nodes with `NodeAttemptReceipt`, and confirmed/ambiguous `SideEffectRecord` must not be rewritten.
- Nodes with committed irreversible side effects must not be silently deleted; only append compensation, skip subsequent paths, append repair nodes, or hand over to human.
- `baseGraphVersion` must match the current graph version, otherwise the patch is rejected.
- `incompatible_restart_required` must not be applied to the original run; a new `HarnessRun` must be created.

## 7. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
|---|---|
| `ExecutionPlan` | deprecated alias, must map to `PlanGraphBundle` |
| Linear `steps` | only allowed as import/debug view; must be normalized to graph before execution |
| `PlanBundle` | product or debug wrapper, not P3 -> P4 canonical contract |

## 8. Test Requirements

- GraphPatch safety test covers three immutable object types: executed nodes, receipts, side effects.
- Scheduler only consumes `PlanGraphBundle`; rejects linear `steps`.
- Single-node tasks must also produce valid graphs.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-8: The contract previously defined PlanGraph as mutable (supporting appendNode), while Architecture §25 explicitly requires PlanGraphBundle as an immutable snapshot. Root cause: Early documents incorrectly wrote in-memory builder's editing semantics as runtime canonical contract. Fix: The main text now explicitly defines `PlanGraphBundle` / `PlanGraph` as immutable snapshots, with all changes only possible via `GraphPatch` generating new versions.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only act as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.