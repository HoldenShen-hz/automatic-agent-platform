# ADR-060 Explicit Planning Layer and Plan Hub

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

## Context

In the early Phase 1A/1B architecture, the execution plan (Plan) generation logic was scattered inside `AgentExecutor`, implemented through an implicit "dispatch mode" for task decomposition. This design had three problems:

1. **Not traceable**: No explicit Plan DTO, making independent validation of plan content impossible.
2. **Not auditable**: Replan decisions have no version chain, making debugging difficult.
3. **Not reusable**: Planning strategies cannot be shared across multiple execution engines.

The OAPEFLIR Loop Model (ADR-016) requires Plan as an independent Hub, forming a clear boundary between Assess, Plan, and Execute.

## Decision

### 1. Establish an Independent Plan Hub

The Plan Hub serves as OAPEFLIR Stage 3 (between Assess and Execute), with the following responsibilities:

- Receive `UnifiedAssessment` (from Assess Hub)
- Output `Plan` DTO (as the sole input to Execute Hub)
- Support multiple planning strategies (linear/dag/conditional/reactive/hierarchical/multi-agent/adaptive/uncertainty-aware)
- Maintain Plan version chain (each replan generates version N+1)

### 2. Plan DTO Core Fields

```typescript
interface Plan {
  planId: string;
  taskId: string;
  version: number;           // increments by 1 on each replan
  strategy: PlanStrategy;    // 8 strategy enums
  steps: PlanStep[];         // DAG node list
  dag: DAGStructure;         // dependencies between steps
  estimatedCost: number;     // token estimate
  estimatedDuration: number; // ms estimate
  retryPolicy: RetryPolicy;
  replanTriggers?: ReplanningTrigger[];
  groundingRefs?: string[];  // knowledge base references
  contextSnapshot: ContextSnapshot;
  createdAt: string;         // ISO 8601
}
```

### 3. R3 Constraints Enforced

| Constraint | Description |
|------|------|
| **R3-SINGLE** | Execute layer can only receive Plan DTO; no bypass for raw task direct execution |
| **R3-BUILDER** | `WorkflowPlanner` is downgraded to a data source for PlanBuilder, does not directly output execution instructions |
| **R3-VERSION** | Each replan must generate version +1; historical versions must not be overwritten |
| **R3-NOBYPASS** | Execute layer must reject input without a valid Plan |

### 4. Plan-to-Execute Bridge

Decoupling Plan from execution engine via `RuntimeExecuteBridge` interface:

```typescript
interface RuntimeExecuteBridge {
  executePlan(plan: Plan): Promise<DualChannelStepOutput>;
  validatePlanInput(plan: Plan): PlanValidationResult;
}
```

Execute layer receives Plan through this interface and must not bypass it.

### 5. 8 Planning Strategies

| Strategy | Use Case | Implementation Status |
|------|---------|---------|
| `linear` | Single-step or sequential execution tasks | Implemented |
| `dag` | Multi-step tasks with dependencies | Implemented |
| `conditional` | Plans with branching logic | Partially implemented |
| `reactive` | Plans responding to external event changes | Partially implemented |
| `hierarchical` | Multi-level abstraction plans | Not implemented |
| `multi-agent` | Multi-agent collaboration plans | Not implemented |
| `adaptive` | Plans adjusted based on execution feedback | Implemented (replan) |
| `uncertainty-aware` | Probabilistic planning for handling uncertainty | Not implemented |

### 6. Replanning Triggers and Decisions

| Trigger Type | Condition | Strategy Selection |
|---------|------|---------|
| `tool_failure` | Tool call failed | `reactive` + retry |
| `context_drift` | Context deviates from original intent | `adaptive` |
| `resource_exhaustion` | Resource exhausted | `linear` degradation |
| `explicit_request` | User explicitly requests replan | `dag` |
| `time_budget_exceeded` | Time budget exceeded | `hierarchical` compression |
| `quality_below_threshold` | Quality below threshold | `uncertainty-aware` |

## Alternatives

### Option A: Keep Dispatch Implicit Planning (Current State)

Pros: No need to refactor existing execution engine.
Cons: Plan is not traceable, not auditable, not reusable.

### Option B: Plan as Independent Hub (Chosen)

Pros: Clear stage boundaries, complete version chain, extensible multi-strategy.
Cons: Requires new `planning/` module, approximately 1500 lines of code.

## Consequences

- New `src/core/planning/` module (~9 files, 2000 lines).
- `RuntimeExecuteBridge` as the Plan-to-Execute decoupling layer.
- Zod schema validation added at stage boundaries (PlanSchema).
- All replan decisions recorded for audit via `ReplanningDecision` DTO.

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 State Machine](./018-rollout-eleven-state-machine.md)
- [ADR-072 Testing Strategy](./072-oapeflir-testing-strategy.md)

## Source Sections

- `§5` Plan Hub Design
- `§L.6` R3 Constraint Definition
- `§H.2` PlanStrategySelector Decision Tree
