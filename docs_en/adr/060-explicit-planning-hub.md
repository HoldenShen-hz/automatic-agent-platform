# ADR-060 Explicit Planning Layer and Plan Hub

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

## Background

In early Phase 1A/1B architecture, the logic for generating execution plans (Plan) was scattered inside `AgentExecutor`, implemented through an implicit "dispatch mode" for task decomposition. This design has three problems:

1. **Non-traceable**: No explicit graph plan contract, cannot independently verify plan content.
2. **Non-auditable**: Replan decisions have no version chain, debugging is difficult.
3. **Non-reusable**: Planning strategy cannot be shared across multiple execution engines.

The OAPEFLIR Loop Model (ADR-016) requires Plan as an independent Hub, forming a clear boundary of Assess→Plan→Execute.

## Decision

### 1. Establish Independent Plan Hub

Plan Hub, as OAPEFLIR Stage 3 (between Assess and Execute), responsibilities:

- Receive `UnifiedAssessment` (from Assess Hub)
- Output `Plan` DTO (as the sole input to Execute Hub)
- Support multiple planning strategies (linear/dag/conditional/reactive/hierarchical/multi-agent/adaptive/uncertainty-aware)
- Maintain Plan version chain (each replan generates version N+1)

### 2. PlanGraphBundle Core Fields

```typescript
interface PlanGraphBundle {
  planGraphBundleId: string;
  harnessRunId: string;
  graphVersion: number;      // Each replan +1
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
| **R3-SINGLE** | Execute layer can only receive `PlanGraphBundle`, no bypass raw task direct execution |
| **R3-BUILDER** | `WorkflowPlanner` demoted to data source for PlanBuilder, does not directly output execution instructions |
| **R3-VERSION** | Each replan must generate version +1, must not overwrite historical versions |
| **R3-NOBYPASS** | Execute layer must reject input without valid Plan |

### 4. Plan→Execute Bridge

Implemented through `RuntimeExecuteBridge` interface to decouple PlanGraphBundle from execution engine:

```typescript
interface RuntimeExecuteBridge {
  executePlan(plan: PlanGraphBundle): Promise<NodeAttemptReceipt>;
  validatePlanInput(plan: PlanGraphBundle): PlanValidationResult;
}
```

Execute layer receives Plan through this interface, cannot bypass.

### 5. 8 Planning Strategies

| Strategy | Applicable Scenario | Implementation Status |
|----------|-------------------|----------------------|
| `linear` | Single-step or sequential execution tasks | Implemented |
| `dag` | Multi-step tasks with dependencies | Implemented |
| `conditional` | Plans with branch judgments | Partially implemented |
| `reactive` | Plans responding to external event changes | Partially implemented |
| `hierarchical` | Multi-level abstract plans | Not implemented |
| `multi-agent` | Multi-Agent collaboration plans | Not implemented |
| `adaptive` | Plans adjusted based on execution feedback | Implemented (replan) |
| `uncertainty-aware` | Probabilistic planning for handling uncertainty | Not implemented |

### 6. Replanning Triggers and Decisions

| Trigger Type | Condition | Strategy Selection |
|-------------|-----------|-------------------|
| `tool_failure` | Tool call failure | `reactive` + retry |
| `context_drift` | Context deviates from original intent | `adaptive` |
| `resource_exhaustion` | Resource exhaustion | `linear` degradation |
| `explicit_request` | User explicit replan request | `dag` |
| `time_budget_exceeded` | Time budget exceeded | `hierarchical` compression |
| `quality_below_threshold` | Quality below threshold | `uncertainty-aware` |

## Alternative Solutions

### Option A: Maintain dispatch implicit planning (status quo)

Advantages: No need to refactor existing execution engine.
Trade-offs: Plan is non-traceable, non-auditable, non-reusable.

### Option B: Plan as independent Hub (selected)

Advantages: Clear stage boundaries, complete version chain, extensible multi-strategy.
Trade-offs: Need to add new planning/ module, about 1500 lines of code.

## Consequences

- New `src/core/planning/` module (about 9 files, 2000 lines).
- `RuntimeExecuteBridge` as decoupled layer from `PlanGraphBundle -> NodeAttemptReceipt`.

## v4.3 ADR Remediation

- A-61: This ADR originally wrote `Plan DTO` and `RuntimeExecuteBridge.executePlan(plan)` as P3 -> P4 sole handoff, root cause being explicit planning ADR成型时 executable contract还未收口到图执行模型. Fix: Body now cuts authoritative input to `PlanGraphBundle`, authoritative output to `NodeAttemptReceipt`.
- Zod schema validation (PlanSchema) added at stage boundary.
- All replan decisions recorded for audit via `ReplanningDecision` DTO.

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-075 Six-level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md) (ADR-018 only retained for historical migration background)
- [ADR-072 Testing Strategy](./072-oapeflir-testing-strategy.md)

## Source Section

- `§5` Plan Hub Design
- `§5.3` PlanGraphBundle Definition
- `§L.4` R3 Constraint Definition
- `§L.5` ReplanningTrigger