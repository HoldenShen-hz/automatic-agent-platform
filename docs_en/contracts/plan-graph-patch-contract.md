# v4.3 Plan Graph And Patch Contract

> v4.3 canonical contract. Covers `PlanGraphBundle` / `PlanGraph` / `PlanNode` / `PlanEdge` / `GraphPatch` / `GraphPatchOperation`.

## 1. Scope

`PlanGraphBundle` is the sole execution plan contract from P3 to P4. All tasks, including simple tasks, must be dispatched in graph form; simple tasks degrade to single-node graphs. `ExecutionPlan` is only permitted as a deprecated alias.

## 2. PlanGraphBundle Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
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

`PlanGraph` minimum fields:

- `graphId`
- `nodes`
- `edges`
- `entryNodeIds`
- `terminalNodeIds`
- `joinStrategy`
- `graphHash`

`PlanNode` minimum fields:

- `nodeId`
- `nodeType` (`tool | llm | hitl_wait | subgraph | evaluator | router | compensation`)
- `inputRefs`
- `outputSchemaRef`
- `riskClass`
- `budgetIntent`
- `sideEffectProfile`
- `retryPolicyRef`
- `timeoutMs`

`PlanEdge` minimum fields:

- `edgeId`
- `fromNodeId`
- `toNodeId`
- `condition`
- `dependencyType` (`hard | soft | compensation | retry | replan`)

## 4. Immutability Constraints

- `PlanGraphBundle` is an immutable snapshot; once dispatched to P4, the `nodes` / `edges` / `schedulerPolicy` / `riskProfile` corresponding to that `graphVersion` must not be modified in place.
- The canonical contract prohibits rewriting an existing `PlanGraph` via `appendNode`, `removeNode`, `updateNode`, or any in-place mutate API.
- Any semantic change must be expressed as `GraphPatch(baseGraphVersion -> newGraphVersion)`, generating a new snapshot version.
- Executed nodes, nodes that have produced a `NodeAttemptReceipt`, and paths with confirmed side effect associations can only be handled by appending compensation or appending remediation paths; historical graphs must not be rewritten.

## 5. GraphPatch

Replan does not overwrite the old graph, only appends a `GraphPatch`:

```
PlanGraph(v1) + GraphPatch(v2 operations) -> PlanGraph(v2)
```

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `graphPatchId` | `string` | patch ID |
| `harnessRunId` | `string` | owning run |
| `baseGraphVersion` | `number` | base version |
| `newGraphVersion` | `number` | new version |
| `operations` | `GraphPatchOperation[]` | closed operations |
| `affectedExecutedNodes` | `string[]` | affected executed nodes |
| `affectedSideEffects` | `string[]` | affected side effects |
| `compatibilityClass` | `safe_append \| requires_checkpoint_revalidation \| requires_human_approval \| incompatible_restart_required` | compatibility class |
| `compensationPlanRef` | `ArtifactRef?` | required compensation plan |
| `policyProofRef` | `ArtifactRef` | policy proof |
| `auditRef` | `ArtifactRef` | audit reference |

`GraphPatchOperation` is a closed enum:

- `add_node`
- `add_edge`
- `disable_edge`
- `add_compensation_node`
- `add_failure_path`
- `mark_skipped`
- `append_subgraph`

## 6. Safety Rules

- Semantics of completed nodes, nodes with `NodeAttemptReceipt`, and confirmed / ambiguous `SideEffectRecord` must not be rewritten.
- Nodes with committed irreversible side effects must not be silently deleted; only compensation may be appended, subsequent paths skipped, remediation nodes appended, or human takeover initiated.
- `baseGraphVersion` must match the current graph version, otherwise the patch is rejected.
- `incompatible_restart_required` must not be applied to the original run; a new `HarnessRun` must be created.

## 7. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `ExecutionPlan` | deprecated alias, must be mapped to `PlanGraphBundle` |
| Linear `steps` | only permitted as import/debug view; must be normalized to graph before execution |
| `PlanBundle` | product or debug wrapper, not P3 -> P4 canonical contract |

## 8. Test Requirements

- GraphPatch safety tests must cover three types of immutable objects: executed nodes, receipts, and side effects.
- Scheduler must only consume `PlanGraphBundle` and reject linear `steps`.
- Single-node tasks must also produce a valid graph.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-8: This contract previously defined PlanGraph as mutable (supporting appendNode), while architecture §25 explicitly requires PlanGraphBundle to be an immutable snapshot. Root cause: early documentation confused in-memory builder edit semantics with runtime canonical contract semantics. Fix: the main text now explicitly states that `PlanGraphBundle` / `PlanGraph` are immutable snapshots, and all changes must be made via `GraphPatch` to generate new versions.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.