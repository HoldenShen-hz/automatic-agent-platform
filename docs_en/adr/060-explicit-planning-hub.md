# ADR-060: Explicit Planning Hub and Plan Hub

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

## Context

In the early Phase 1A/1B architecture, the logic for generating Execution Plans (Plan) was scattered within `AgentExecutor`, implementing task decomposition through an implicit "dispatch mode". This design has three problems:

1. **Not traceable**: No explicit graph plan contract, cannot independently verify plan content.
2. **Not auditable**: Replanning decisions have no version chain, debugging is difficult.
3. **Not reusable**: Planning strategies cannot be shared across multiple execution engines.

The OAPEFLIR Loop Model (ADR-016) requires Plan as an independent Hub, forming clear boundaries for Assess→Plan→Execute.

## Decision

### 1. Establish Independent Plan Hub

Plan Hub, as the OAPEFLIR Stage 3 (between Assess and Execute), is responsible for:

- Receiving `UnifiedAssessment` (from Assess Hub)
- Outputting `Plan` DTO (as the only input to Execute Hub)
- Supporting multiple planning strategies (linear/dag/conditional/reactive/hierarchical/multi-agent/adaptive/uncertainty-aware)
- Maintaining Plan version chain (each replan generates version N+1)

### 2. PlanGraphBundle Core Fields

```typescript
interface PlanGraphBundle {
  planGraphBundleId: string;
  harnessRunId: string;
  graphVersion: number;      // +1 for each replan
  strategy: PlanStrategy;    // 8 strategy enums
  graph: PlanGraph;          // Nodes and edges
  estimatedCost: number;     // Token estimate
  estimatedDuration: number; // ms estimate
  retryPolicy: RetryPolicy;
  replanTriggers?: ReplanningTrigger[];
  groundingRefs?: string[];  // Knowledge base references
  contextSnapshot: ContextSnapshot;
  createdAt: string;         // ISO 8601
}
```

### 3. R3 Constraints Enforcement

| Constraint | Description |
|------------|-------------|
| **R3-SINGLE** | Execute layer can only receive `PlanGraphBundle`, bypass of raw task direct execution is not allowed |
| **R3-BUILDER** | `WorkflowPlanner` is demoted to data source for PlanBuilder, does not directly output execution instructions |
| **R3-VERSION** | Each replan must generate version +1, must not overwrite historical versions |
| **R3-NOBYPASS** | Execute layer must reject input without valid Plan |

### 4. Plan→Execute Bridge

Decoupling PlanGraphBundle from execution engine through `RuntimeExecuteBridge` interface:

```typescript
interface RuntimeExecuteBridge {
  executePlan(plan: PlanGraphBundle): Promise<NodeAttemptReceipt>;
  validatePlanInput(plan: PlanGraphBundle): PlanValidationResult;
}
```

Execute layer receives Plan through this interface, bypass is not allowed.

### 5. 8 Planning Strategies

| Strategy | Applicable Scenario | Implementation Status |
|----------|---------------------|----------------------|
| `linear` | Single-step or sequential execution tasks | Implemented |
| `dag` | Multi-step tasks with dependencies | Implemented |
| `conditional` | Plans with branching decisions | Partially implemented |
| `reactive` | Plans responding to external event changes | Partially implemented |
| `hierarchical` | Multi-level abstract plans | Not implemented |
| `multi-agent` | Multi-Agent collaboration plans | Not implemented |
| `adaptive` | Plans adjusted based on execution feedback | Implemented (replan) |
| `uncertainty-aware` | Probabilistic planning for handling uncertainty | Not implemented |

### 6. Replanning Triggers and Decisions

| Trigger Type | Condition | Strategy Selection |
|--------------|-----------|-------------------|
| `tool_failure` | Tool call failure | `reactive` + retry |
| `context_drift` | Context deviating from original intent | `adaptive` |
| `resource_exhaustion` | Resource exhaustion | `linear` degradation |
| `explicit_request` | User explicit replan request | `dag` |
| `time_budget_exceeded` | Time budget exceeded | `hierarchical` compression |
| `quality_below_threshold` | Quality below threshold | `uncertainty-aware` |

## Alternative Approaches

### Approach A: Maintain dispatch implicit planning (current state)

Advantages: No need to refactor existing execution engine.
Disadvantages: Plan is not traceable, not auditable, not reusable.

### Approach B: Plan as independent Hub (chosen)

Advantages: Clear stage boundaries, complete version chain, scalable multi-strategy.
Disadvantages: Need to add new planning/ module, approximately 1500 lines of code.

## Consequences

- New `src/core/planning/` module (approximately 9 files, 2000 lines).
- `RuntimeExecuteBridge` as `PlanGraphBundle -> NodeAttemptReceipt` decoupling layer.

## v4.3 ADR Remediation

- A-61: This ADR originally wrote `Plan DTO` and `RuntimeExecuteBridge.executePlan(plan)` as the P3 -> P4 unique handoff. Root cause was that when the explicit planning ADR took shape, the executable contract had not yet been closed to the graph execution model. Fix: The text now switches authoritative input to `PlanGraphBundle` and authoritative output to `NodeAttemptReceipt`.
- Zod schema validation added at stage boundaries (PlanSchema).
- All replanning decisions recorded for audit via `ReplanningDecision` DTO.

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md) (ADR-018 only retained for historical migration background)
- [ADR-072 Testing Strategy](./072-oapeflir-testing-strategy.md)

## Source Section

- `§5` Plan Hub Design
- `§5.3` PlanGraphBundle Definition
- `§L.4` R3 Constraint Definition
- `§L.5` ReplanningTrigger