# ADR-060 Explicit Planning Layer and Plan Hub

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Phase Cognitive Loop Model

## Context

In the early Phase 1A/1B architecture, the generation logic for execution plans (Plan) was scattered within `AgentExecutor`, implementing task decomposition through an implicit "dispatch mode". This design has three problems:

1. **Non-traceable**: No explicit Plan DTO, making it impossible to independently validate plan content.
2. **Non-auditable**: Replan decisions have no version chain, making debugging difficult.
3. **Non-reusable**: Planning strategies cannot be shared across multiple execution engines.

The OAPEFLIR Loop model (ADR-016) requires Plan as an independent Hub, forming a clear Assess → Plan → Execute boundary.

## Decision

### 1. Establish Independent Plan Hub

Plan Hub serves as OAPEFLIR Phase 3 (between Assess and Execute), with responsibilities:

- Receive `UnifiedAssessment` (from Assess Hub)
- Output `Plan` DTO (as the sole input to Execute Hub)
- Support multiple planning strategies (linear/dag/conditional/reactive/hierarchical/multi-agent/adaptive/uncertainty-aware)
- Maintain Plan version chain (each replan generates version N+1)

### 2. Plan DTO Core Fields

```typescript
interface Plan {
  planId: string;
  taskId: string;
  version: number;           // Each replan +1
  strategy: PlanStrategy;    // 8 strategy enums
  steps: PlanStep[];         // DAG node list
  dag: DAGStructure;         // Dependencies between steps
  estimatedCost: number;     // Token estimate
  estimatedDuration: number; // ms estimate
  retryPolicy: RetryPolicy;
  replanTriggers?: ReplanningTrigger[];
  groundingRefs?: string[];  // Knowledge base references
  contextSnapshot: ContextSnapshot;
  createdAt: string;         // ISO 8601
}
```

### 3. R3 Constraint Enforcement

| Constraint | Description |
|------------|-------------|
| **R3-SINGLE** | Execute layer can only receive Plan DTO, not allow bypass raw task direct execution |
| **R3-BUILDER** | `WorkflowPlanner` is degraded to PlanBuilder data source, does not directly output execution instructions |
| **R3-VERSION** | Each replan must generate version +1, must not overwrite historical versions |
| **R3-NOBYPASS** | Execute layer must reject inputs without valid Plan |

### 4. Plan→Execute Bridge

Decoupling Plan from execution engine through `RuntimeExecuteBridge` interface:

```typescript
interface RuntimeExecuteBridge {
  executePlan(plan: Plan): Promise<DualChannelStepOutput>;
  validatePlanInput(plan: Plan): PlanValidationResult;
}
```

Execute layer receives Plan through this interface and must not bypass it.

### 5. Eight Planning Strategies

| Strategy | Applicable Scenario | Implementation Status |
|----------|---------------------|----------------------|
| `linear` | Single-step or sequential execution tasks | Implemented |
| `dag` | Multi-step tasks with dependencies | Implemented |
| `conditional` | Plans with branching decisions | Partially implemented |
| `reactive` | Plans responding to external event changes | Partially implemented |
| `hierarchical` | Multi-level abstraction plans | Not implemented |
| `multi-agent` | Multi-Agent collaboration plans | Not implemented |
| `adaptive` | Plans adjusted based on execution feedback | Implemented (replan) |
| `uncertainty-aware` | Probabilistic planning for handling uncertainty | Not implemented |

### 6. Replanning Triggers and Decisions

| Trigger Type | Condition | Strategy Selection |
|--------------|-----------|-------------------|
| `tool_failure` | Tool call failure | `reactive` + retry |
| `context_drift` | Context deviates from original intent | `adaptive` |
| `resource_exhaustion` | Resource exhaustion | `linear` degradation |
| `explicit_request` | User explicitly requests replanning | `dag` |
| `time_budget_exceeded` | Time budget exceeded | `hierarchical` compression |
| `quality_below_threshold` | Quality below threshold | `uncertainty-aware` |

## Alternative Approaches

### Option A: Maintain dispatch implicit planning (current state)

Advantages: No need to refactor existing execution engine.
Costs: Plan is non-traceable, non-auditable, non-reusable.

### Option B: Plan as independent Hub (selected)

Advantages: Clear phase boundaries, complete version chain, multi-strategy extensibility.
Costs: Need to add new planning/ module, approximately 1500 lines of code.

## Consequences

- New `src/core/planning/` module (approximately 9 files, 2000 lines).
- `RuntimeExecuteBridge` as Plan→Execute decoupling layer.
- Zod schema validation added at phase boundaries (PlanSchema).
- All replan decisions recorded in audit via `ReplanningDecision` DTO.

## Cross-References

- [ADR-016 OAPEFLIR Eight-Phase Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 State Machine](./018-rollout-eleven-state-machine.md)
- [ADR-072 Testing Strategy](./072-oapeflir-testing-strategy.md)

## Source Section

- `§5` Plan Hub Design
- `§L.6` R3 Constraint Definition
- `§H.2` PlanStrategySelector Decision Tree