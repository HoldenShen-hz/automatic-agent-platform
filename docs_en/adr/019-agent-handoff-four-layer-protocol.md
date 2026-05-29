# ADR-019 Agent Handoff Four-Layer Serialization Protocol

- Status: Accepted
- Decision Date: 2026-04-17

## Background

In multi-agent scenarios, agents need to transfer execution context (state, plan, summary). Current implementation uses natural language `priorSummaries` transfer, lacking structured serialization and token budget control.

This document defines and adopts a four-layer Handoff model. This ADR serves as the baseline for the current structured handoff protocol.

## Decision

### Four-Layer Handoff Model

| Layer | Content | Token Budget | Applicable Scenario |
|-------|---------|-------------|---------------------|
| **L1** Context Summary | Natural language summary (<200 tokens) | ~200 | Simple handoff, fast path |
| **L2** State Delta | Current state + delta (<500 tokens) | ~500 | Medium complexity, state-dependent |
| **L3** Facts & PlanDelta | Structured facts + plan changes (<2000 tokens) | ~2000 | Complex multi-step, with explicit plan changes |
| **L4** Full | Complete context (including history) (<8000 tokens) | ~8000 | Full handoff, diagnosis/audit |

### Handoff Serializer Interface

```typescript
interface HandoffSerializer {
  // Serialize by layer
  serialize(context: HandoffContext, level: HandoffLevel): string;
  // Extract facts/state/plan delta from node attempt receipt
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
- GAP-V2-05 (Handoff four-layer protocol) to implement.

## Consequences

- The four-layer Handoff model makes inter-agent context transfer from "natural language black box" to "structured analyzable" protocol.
- Combined with OAPEFLIR Loop, agent collaboration in the secondary chain (F→L→I→R) will benefit from this protocol.
- Future can analyze agent collaboration bottlenecks based on Handoff logs.

## Alternative Options

1. **Natural language summary (current implementation)**: Simple to implement, but token budget uncontrollable, semantic compression quality unstable.
2. **Only pass L1/L2**: Lower complexity without passing L3/L4, but complex multi-step scenarios lack necessary context.
3. **Full state serialization (e.g., JSON)**: Most complete information, but high token overhead, and requires schema alignment between parties.
4. **Adopt this decision**: Four-layer model, select layer by scenario, balance information completeness and token budget.

## Cross-References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-060 Explicit Planning Hub](./060-explicit-planning-hub.md)

## Source Sections

- `§13` OAPEFLIR Agent Handoff Model (v4.3 architecture system)
- `§41-§42` Progressive Autonomy and Agent Collaboration Protocol