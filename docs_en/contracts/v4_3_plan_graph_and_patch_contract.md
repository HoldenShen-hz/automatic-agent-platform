# v4.3 Plan Graph And Patch Contract

> v4.3 canonical contract. Covers `PlanGraphBundle` / `PlanGraph` / `PlanNode` / `PlanEdge` / `GraphPatch` / `GraphPatchOperation`.

## 1. Scope

`PlanGraphBundle` is the sole execution plan contract from P3 -> P4. All tasks, including simple tasks, must be dispatched in graph form; simple tasks degrade to single-node graph. `ExecutionPlan` is only allowed as deprecated alias.

## 2. PlanGraphBundle Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `planGraphBundleId` | `string` | Bundle ID |
| `harnessRunId` | `string` | Associated run |
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

Replan does not overwrite old graph, only appends `GraphPatch`:

```
PlanGraph(v1) + GraphPatch(v2 operations) -> PlanGraph(v2)
```

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `graphPatchId` | `string` | Patch ID |
| `harnessRunId` | `string` | Associated run |
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
- `disable_unstarted_node`
- `skip_pending_path`
- `append_compensation_node`
- `append_repair_node`
- `update_scheduler_policy`
- `update_budget_intent`

## 5. Safety Rules

- Semantics of completed nodes, nodes with `NodeAttemptReceipt`, and confirmed / ambiguous `SideEffectRecord` must not be rewritten.
- Nodes with committed irreversible side effects must not be silently deleted; can only append compensation, skip subsequent paths, append repair nodes, or be taken over by human.
- `baseGraphVersion` must match current graph version, otherwise patch is rejected.
- `incompatible_restart_required` must not be applied to original run; must create new `HarnessRun`.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `ExecutionPlan` | Deprecated alias, must map to `PlanGraphBundle` |
| Linear `steps` | Can only be used as import/debug view; must normalize to graph before execution |
| `PlanBundle` | Product or debug wrapper, not P3 -> P4 canonical contract |

## 7. Testing Requirements

- GraphPatch safety test covers three types of non-rewritable objects: executed nodes, receipts, and side effects.
- Scheduler only consumes `PlanGraphBundle`, rejects linear `steps`.
- Single-node task must also produce valid graph.
