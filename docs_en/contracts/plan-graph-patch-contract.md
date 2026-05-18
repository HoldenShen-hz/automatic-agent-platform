# v4.3 Plan Graph And Patch Contract

> v4.3 canonical contract. Covers `PlanGraphBundle` / `PlanGraph` / `PlanNode` / `PlanEdge` / `GraphPatch` / `GraphPatchOperation`.

## 1. Scope

`PlanGraphBundle` is the sole execution plan contract from P3 -> P4. All tasks, including simple tasks, must be dispatched in graph form; simple tasks degenerate to single-node graphs. `ExecutionPlan` is only allowed as a deprecated alias.

## 2. PlanGraphBundle Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `planGraphBundleId` | `string` | Bundle ID |
| `harnessRunId` | `string` | Parent run |
| `graphVersion` | `number` | Graph version |
| `graph` | `PlanGraph` | Graph structure |
| `schedulerPolicy` | `ReadyNodeSchedulingPolicy` | Scheduling policy |
| `budget` | `BudgetPlanRef` | Budget plan reference |
| `riskProfile` | `RiskProfile` | Graph-level risk |
| `validationReport` | `GraphValidationReport` | Graph validation report |
| `artifactRefs` | `ArtifactRef[]` | Large object references |
| `createdAt` | `timestamp` | Creation time |

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

- `PlanGraphBundle` is an immutable snapshot; once dispatched to P4, `nodes` / `edges` / `schedulerPolicy` / `riskProfile` corresponding to `graphVersion` must not be modified in place.
- Canonical contract prohibits rewriting existing `PlanGraph` through any in-place mutate API such as `appendNode`, `removeNode`, or `updateNode`.
- Any semantic change must be expressed as `GraphPatch(baseGraphVersion -> newGraphVersion)` and generate a new snapshot version.
- Executed nodes, nodes with `NodeAttemptReceipt`, and paths with confirmed side effect associations may only be handled through appending compensation or appending repair paths, not by rewriting the historical graph.

## 5. GraphPatch

Replan does not overwrite the old graph, only appends `GraphPatch`:

```text
PlanGraph(v1) + GraphPatch(v2 operations) -> PlanGraph(v2)
```

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `graphPatchId` | `string` | Patch ID |
| `harnessRunId` | `string` | Parent run |
| `baseGraphVersion` | `number` | Base version |
| `newGraphVersion` | `number` | New version |
| `operations` | `GraphPatchOperation[]` | Closed operations |
| `affectedExecutedNodes` | `string[]` | Affected executed nodes |
| `affectedSideEffects` | `string[]` | Affected side effects |
| `compatibilityClass` | `safe_append \| requires_checkpoint_revalidation \| requires_human_approval \| incompatible_restart_required` | Compatibility class |
| `compensationPlanRef` | `ArtifactRef?` | Required compensation plan |
| `policyProofRef` | `ArtifactRef` | Policy proof |
| `auditRef` | `ArtifactRef` | Audit reference |

`GraphPatchOperation` is a closed enum:

- `add_node`
- `add_edge`
- `disable_edge`
- `add_compensation_node`
- `add_failure_path`
- `mark_skipped`
- `append_subgraph`

## 6. Security Rules

- Completed nodes, nodes with `NodeAttemptReceipt`, and nodes with confirmed / ambiguous `SideEffectRecord` semantics must not be rewritten.
- Nodes with committed irreversible side effects must not be silently deleted; only compensation, skipping subsequent paths, appending repair nodes, or human takeover may be added.
- `baseGraphVersion` must match the current graph version, otherwise the patch must be rejected.
- `incompatible_restart_required` must not be applied to the original run; a new `HarnessRun` must be created.

## 7. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `ExecutionPlan` | Deprecated alias, must map to `PlanGraphBundle` |
| Linear `steps` | May only serve as import/debug view; must be normalized to graph before execution |
| `PlanBundle` | Product or debug wrapper, not P3 -> P4 canonical contract |

## 8. Test Requirements

- GraphPatch safety test covers three types of non-rewritable objects: executed nodes, receipts, side effects.
- Scheduler only consumes `PlanGraphBundle` and rejects linear `steps`.
- Single-node tasks must also produce a valid graph.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-8: The contract defined PlanGraph as mutable (supporting appendNode), but architecture §25 explicitly requires PlanGraphBundle as an immutable snapshot. Root cause: early documents incorrectly wrote the in-memory builder's edit semantics as the runtime canonical contract. Fix: The body now explicitly states that `PlanGraphBundle` / `PlanGraph` are immutable snapshots, and all changes may only be made through `GraphPatch` generating new versions.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plan must use `PlanGraphBundle`; execution result must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only be `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.