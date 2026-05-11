# ADR-060 Explicit Planning Hub and Plan Hub

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

## Context

In the early Phase 1A/1B architecture, the execution plan (Plan) generation logic was scattered inside `AgentExecutor`, implemented through an implicit "dispatch mode" for task decomposition. This design has three problems:

1. **Not traceable**: No explicit graph plan contract, unable to perform independent verification of plan content.
2. **Not auditable**: Replan decisions have no version chain, making debugging difficult.
3. **Not reusable**: Planning strategies cannot be shared across multiple execution engines.

The OAPEFLIR Loop model (ADR-016) requires Plan as an independent Hub, forming a clear boundary of Assess→Plan→Execute.

## Decision

### 1. Establish Independent Plan Hub

Plan Hub, as the OAPEFLIR Stage 3 (between Assess and Execute), is responsible for:

- Receiving `UnifiedAssessment` (from Assess Hub)
- Outputting `Plan` DTO (as the sole input to Execute Hub)
- Supporting multiple planning strategies (linear/dag/conditional/reactive/hierarchical/multi-agent/adaptive/uncertainty-aware)
- Maintaining Plan version chain (each replan generates version N+1)

### 2. PlanGraphBundle Core Fields

```typescript
interface PlanGraphBundle {
  planGraphBundleId: string;
  harnessRunId: string;
  graphVersion: number;      // increments by 1 on each replan
  strategy: PlanStrategy;    // 8 strategy enums
  graph: PlanGraph;          // nodes and edges
  estimatedCost: number;     // token estimate
  estimatedDuration: number; // ms estimate
  retryPolicy: RetryPolicy;
  replanTriggers?: ReplanningTrigger[];
  groundingRefs?: string[];  // knowledge base references
  contextSnapshot: ContextSnapshot;
  createdAt: string;         // ISO 8601
}
```

### 3. R3 Constraint Enforcement

| Constraint | Description |
|------------|-------------|
| **R3-SINGLE** | Execute layer can only receive `PlanGraphBundle`, bypass of raw task direct execution is not allowed |
| **R3-BUILDER** | `WorkflowPlanner` is demoted to data source of PlanBuilder, does not directly output execution instructions |
| **R3-VERSION** | Each replan must generate version +1, must not overwrite historical versions |
| **R3-NOBYPASS** | Execute layer must reject inputs without valid Plan |

### 4. Plan→Execute Bridge

Decoupling of PlanGraphBundle to execution engine is achieved through `RuntimeExecuteBridge` interface:

```typescript
interface RuntimeExecuteBridge {
  executePlan(plan: PlanGraphBundle): Promise<NodeAttemptReceipt>;
  validatePlanInput(plan: PlanGraphBundle): PlanValidationResult;
}
```

Execute layer receives Plan through this interface and must not bypass it.

### 5. 8 Planning Strategies

| Strategy | Applicable Scenario | Implementation Status |
|----------|--------------------|-----------------------|
| `linear` | Single-step or sequential execution tasks | Implemented |
| `dag` | Multi-step tasks with dependencies | Implemented |
| `conditional` | Plans with branch decisions | Partially implemented |
| `reactive` | Plans responding to external event changes | Partially implemented |
| `hierarchical` | Multi-level abstract plans | Not implemented |
| `multi-agent` | Multi-Agent collaboration plans | Not implemented |
| `adaptive` | Plans adjusted based on execution feedback | Implemented (replan) |
| `uncertainty-aware` | Probabilistic planning for handling uncertainty | Not implemented |

### 6. Replanning Triggers and Decisions

| Trigger Type | Condition | Strategy Selection |
|--------------|-----------|-------------------|
| `tool_failure` | Tool invocation failure | `reactive` + retry |
| `context_drift` | Context deviates from original intent | `adaptive` |
| `resource_exhaustion` | Resource exhaustion | `linear` degradation |
| `explicit_request` | User explicit replan request | `dag` |
| `time_budget_exceeded` | Time budget exceeded | `hierarchical` compression |
| `quality_below_threshold` | Quality below threshold | `uncertainty-aware` |

## Alternatives

### Option A: Maintain dispatch implicit planning (current state)

Pros: No need to refactor existing execution engine.
Cons: Plan is not traceable, not auditable, not reusable.

### Option B: Plan as independent Hub (selected)

Pros: Clear stage boundaries, complete version chain, multi-strategy extensibility.
Cons: Requires new planning/ module, approximately 1500 lines of code.

## Consequences

- New `src/core/planning/` module (approximately 9 files, 2000 lines).
- `RuntimeExecuteBridge` as the decoupling layer for `PlanGraphBundle -> NodeAttemptReceipt`.

## v4.3 ADR Remediation

- A-61: This ADR originally wrote `Plan DTO` and `RuntimeExecuteBridge.executePlan(plan)` as P3 -> P4 sole handoff, root cause being the explicit planning ADR took shape before the executable contract was closed to the graph execution model. Fix: The main text now cuts authoritative input to `PlanGraphBundle`, and authoritative output to `NodeAttemptReceipt`.
- Added Zod schema validation at stage boundaries (PlanSchema).
- All replan decisions are recorded for audit through `ReplanningDecision` DTO.

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 State Machine](./018-rollout-eleven-state-machine.md)
- [ADR-072 OAPEFlir Testing Strategy](./072-oapeflir-testing-strategy.md)

## Source Sections

- `§5` Plan Hub Design
- `§5.3` PlanGraphBundle Definition
- `§L.4` R3 Constraint Definition
- `§L.5` ReplanningTrigger