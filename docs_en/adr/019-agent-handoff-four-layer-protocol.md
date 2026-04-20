# ADR-019 Agent Handoff Four-Layer Serialization Protocol

- Status: Accepted
- Decision Date: 2026-04-17

## Context

In multi-agent scenarios, agents need to pass execution context (state, plan, summary) between each other. Current implementation uses natural language `priorSummaries` for passing, lacking structured serialization and token budget control.

§12 defines four-layer Handoff model, this ADR formally adopts that model.

## Decision

### Four-Layer Handoff Model

| Layer | Content | Token Budget | Applicable Scenario |
|-------|---------|--------------|---------------------|
| **L1** Context Summary | Natural language summary (<200 tokens) | ~200 | Simple handover, fast path |
| **L2** State Delta | Current state + delta (<500 tokens) | ~500 | Medium complexity, stateful dependency |
| **L3** Facts & PlanDelta | Structured facts + plan changes (<2000 tokens) | ~2000 | Complex multi-step, explicit plan changes |
| **L4** Full | Full context including history (<8000 tokens) | ~8000 | Full handover, diagnosis/audit |

### HandoffSerializer Interface

```typescript
interface HandoffSerializer {
  // Serialize by layer
  serialize(context: HandoffContext, level: HandoffLevel): string;
  // Extract facts/state/plan delta from step result
  buildFromStepResult(result: StepResult): HandoffContext;
  // Trim by token budget
  truncate(content: string, budgetTokens: number): string;
}
```

### Token Budget Allocation Strategy

```
Total budget: 10000 tokens
├─ L1: 200 tokens (2%)
├─ L2: 500 tokens (5%)
├─ L3: 2000 tokens (20%)
└─ L4: 8000 tokens (80%)
```

### Current Implementation Status

- `src/core/agent-loop/handoff-model.ts`: Has type definition, no actual serialization logic.
- GAP-V2-05 (Handoff four-layer protocol) to implement.

## Consequences

- Handoff four-layer model transforms agent-to-agent context passing from "natural language black box" to "structured analyzable" protocol.
- Combined with OAPEFLIR Loop, agent-to-agent collaboration in secondary chain (F→L→I→R) will benefit from this protocol.
- Future can analyze agent collaboration bottlenecks based on Handoff logs.
