# v4.3 Plan Graph And Patch Contract

> v4.3 canonical contract. Covers `PlanGraphBundle` / `PlanGraph` / `PlanNode` / `PlanEdge` / `GraphPatch` / `GraphPatchOperation`.

## 1. Scope

`PlanGraphBundle` is the sole execution plan contract for P3 -> P4. All tasks, including simple tasks, must be issued in graph form; simple tasks degenerate to single-node graphs. `ExecutionPlan` is only permitted as a deprecated alias.

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

## 4. GraphPatch

Replan does not overwrite the old graph; it only appends `GraphPatch`:

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

## 5. Safety Rules

- Completed nodes, nodes with existing `NodeAttemptReceipt`, and confirmed / ambiguous `SideEffectRecord` semantics must not be rewritten.
- Nodes with committed irreversible side effects must not be silently deleted; only append compensation, skip subsequent paths, append fix nodes, or hand over to human.
- `baseGraphVersion` must match the current graph version, otherwise the patch is rejected.
- `incompatible_restart_required` must not be applied to the original run; a new `HarnessRun` must be created.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `ExecutionPlan` | Deprecated alias, must map to `PlanGraphBundle` |
| Linear `steps` | Only serve as import/debug view; must be normalized to graph before execution |
| `PlanBundle` | Product or debug wrapper, not P3 -> P4 canonical contract |

## 7. Test Requirements

- GraphPatch safety test covers three types of non-rewritable objects: executed nodes, receipts, and side effects.
- Scheduler only consumes `PlanGraphBundle`, rejects linear `steps`.
- Single-node tasks must also produce a valid graph.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-8: Contract defines PlanGraph as mutable (supports appendNode), architecture §25 explicitly requires PlanGraphBundle as an immutable snapshot. Fix: This semantics converges to v4.3 canonical contract; old fields, old states, old DTOs, or old terminology are only permitted as legacy/deprecated/projection/migration input, not as new implementation entry points.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only serve as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.