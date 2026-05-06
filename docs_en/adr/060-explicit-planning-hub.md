# ADR-060 Explicit Planning Hub and Plan Hub

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

## Context

In the early Phase 1A/1B architecture, the generation logic for execution plans (Plan) was scattered within `AgentExecutor`, implementing task decomposition through an implicit "dispatch mode". This design has three problems:

1. **Not traceable**: No explicit Plan DTO, making it impossible to independently validate plan content.
2. **Not auditable**: Replan decisions have no version chain, making debugging difficult.
3. **Not reusable**: Planning strategies cannot be shared across multiple execution engines.

The OAPEFLIR Loop model (ADR-016) requires Plan as an independent Hub, forming a clear Assess → Plan → Execute boundary.

## Decision

### 1. Establish Independent Plan Hub

Plan Hub serves as OAPEFLIR Stage 3 (between Assess and Execute), with responsibilities:

- Receive `UnifiedAssessment` (from Assess Hub)
- Output `PlanGraphBundle` (as the sole canonical input to Execute Hub per §5.3)
- Support multiple planning strategies (linear/dag/conditional/reactive/hierarchical/multi-agent/adaptive/uncertainty-aware)
- Maintain Plan version chain (each replan generates version N+1)

### 2. PlanGraphBundle Core Fields

```typescript
interface PlanGraphBundle {
  planGraphBundleId: string;
  harnessRunId: string;
  graphVersion: number;      // Each replan +1
  strategy: PlanStrategy;    // 8 strategy enums
  graph: PlanGraph;          // Nodes and edges (DAG structure)
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
| **R3-SINGLE** | Execute layer can only receive `PlanGraphBundle`, not allow bypass raw task direct execution |
| **R3-BUILDER** | `WorkflowPlanner` is degraded to PlanBuilder data source, does not directly output execution instructions |
| **R3-VERSION** | Each replan must generate version +1, must not overwrite historical versions |
| **R3-NOBYPASS** | Execute layer must reject inputs without valid `PlanGraphBundle` |

### 4. Plan→Execute Compatibility Bridge

The canonical runtime handoff is `PlanGraphBundle -> HarnessRuntime / NodeAttemptReceipt`. A compatibility bridge interface may be retained at the boundary layer:

```typescript
interface RuntimeExecuteBridge {
  executePlan(plan: PlanGraphBundle): Promise<NodeAttemptReceipt>;
  validatePlanInput(plan: PlanGraphBundle): PlanValidationResult;
}
```

`RuntimeExecuteBridge` is only permitted as a compatibility seam and must not replace `PlanGraphBundle` as the authoritative P3→P4 contract.

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

## Alternatives

### Option A: Maintain dispatch implicit planning (current state)

Advantages: No need to refactor existing execution engine.
Costs: Plan is non-traceable, non-auditable, non-reusable.

### Option B: Plan as independent Hub (selected)

Advantages: Clear phase boundaries, complete version chain, multi-strategy extensibility.
Costs: Need to add new planning/ module, approximately 1500 lines of code.

## Consequences

- New `src/platform/orchestration/` module (approximately 9 files, 2000 lines).
- `PlanGraphBundle` as the sole P3→P4 handoff; `RuntimeExecuteBridge` retained only as a compatibility seam.
- Zod schema validation added at phase boundaries (PlanSchema).
- All replan decisions recorded in audit via `ReplanningDecision` DTO.

## v4.3 ADR Remediation

- A-61: This ADR originally defined `Plan DTO` and `RuntimeExecuteBridge.executePlan(plan)` as the sole P3→P4 handoff. The root cause was that the explicit planning ADR was finalized before the executable contract was locked down to the graph execution model. Fix: The main text now uses `PlanGraphBundle` as the authoritative input and `NodeAttemptReceipt` as the authoritative output.
- §176-2054 Fix Explanation: The original ADR defined `Plan{steps:PlanStep[]}` as the P3→P4 canonical contract, but platform spec §5.3/§13 explicitly requires `PlanGraphBundle` (DAG structure) as the sole canonical execution contract. `Plan{steps:[]}` is a legacy linear plan alias (deprecated), and must not be used as a data structure for new implementations. PlanGraphBundle is the current sole authoritative input.
- Added Zod schema validation at phase boundaries (PlanSchema).
- All replan decisions recorded in audit via `ReplanningDecision` DTO.

## Cross-References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 State Machine](./018-rollout-eleven-state-machine.md)
- [ADR-072 Testing Strategy](./072-oapeflir-testing-strategy.md)

## Source Section

- `§5` Plan Hub Design
- `§13.5` OAPEFLIR→Harness External Semantic Mapping
- `§13.8` PlanGraphBundle Schema Definition
