# ADR-019 Agent Handoff Four-Layer Serialization Protocol

- Status: Accepted
- Decision Date: 2026-04-17

## Context

In multi-agent scenarios, agents need to transfer execution context (state, plan, summary) between each other. The current implementation uses natural language `priorSummaries` for transfer, lacking structured serialization and token budget control.

Section 12 defines a four-layer Handoff model, and this ADR formally adopts that model.

## Decision

### Four-Layer Handoff Model

| Layer | Content | Token Budget | Use Case |
|-------|---------|-------------|----------|
| **L1** Context Summary | Natural language summary (<200 tokens) | ~200 | Simple handoff, fast path |
| **L2** State Delta | Current state + changes (<500 tokens) | ~500 | Medium complexity, stateful dependencies |
| **L3** Facts & PlanDelta | Structured facts + plan changes (<2000 tokens) | ~2000 | Complex multi-step, explicit plan changes |
| **L4** Full | Full context (with history) (<8000 tokens) | ~8000 | Full handoff, diagnostics/audit |

### Handoff Serializer Interface

```typescript
interface HandoffSerializer {
  // Serialize by layer
  serialize(context: HandoffContext, level: HandoffLevel): string;
  // Extract facts / state / plan delta from node attempt receipt
  buildFromNodeAttemptReceipt(receipt: NodeAttemptReceipt): HandoffContext;
  // Truncate by token budget
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

- `src/platform/five-plane-orchestration/agent-delegation/handoff-model.ts`: Has type definitions, no actual serialization logic.
- GAP-V2-05 (Handoff four-layer protocol) pending implementation.

## Consequences

- The four-layer Handoff model transforms agent-to-agent context transfer from a "natural language black box" into a "structured analyzable" protocol.
- Combined with the OAPEFLIR Loop, inter-agent collaboration in the secondary chain (F→L→I→R) will benefit from this protocol.
- Future analysis of agent collaboration bottlenecks can be based on Handoff logs.

## Alternatives Considered

1. **Natural language summary (current implementation)**: Simple to implement, but token budget is uncontrollable and semantic compression quality is inconsistent.
2. **Only transfer L1/L2**: Reducing complexity by not transferring L3/L4, but complex multi-step scenarios lack necessary context.
3. **Full state serialization (e.g., JSON)**: Most complete information, but high token overhead and requires schema alignment between parties.
4. **Adopt this decision**: Four-layer model, choose layer by scenario, balancing information completeness and token budget.

## Cross-references

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-060 Explicit Planning Hub](./060-explicit-planning-hub.md)

## Source Section

- `§13` OAPEFLIR Agent Handoff Model (v4.3 architecture system)
- `§41-§42` Progressive Autonomy and Agent Collaboration Protocol
