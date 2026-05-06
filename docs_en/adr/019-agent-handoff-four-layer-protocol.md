# ADR-019 Agent Handoff Four-Layer Serialization Protocol

- Status: Accepted
- Decision Date: 2026-04-17

## Background

In multi-agent scenarios, agents need to transfer execution context (state, plan, summary) between each other. Current implementation uses natural language `priorSummaries` for transfer, lacking structured serialization and token budget control.

The architecture handoff subsection defines a four-layer Handoff model, which this ADR formally adopts.

## Decision

### Four-Layer Handoff Model

| Layer | Content | Token Budget | Applicable Scenario |
|-------|---------|--------------|---------------------|
| **L1** Context Summary | Natural language summary (<200 tokens) | ~200 | Simple handoff, fast path |
| **L2** State Delta | Current state + delta (<500 tokens) | ~500 | Medium complexity, state-dependent |
| **L3** Facts & PlanDelta | Structured facts + plan changes (<2000 tokens) | ~2000 | Complex multi-step, explicit plan changes |
| **L4** Full | Complete context (including history) (<8000 tokens) | ~8000 | Full handoff, diagnosis/audit |

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

Current canonical handoff / delegation contract see [agent_handoff_contract.md](../contracts/agent_handoff_contract.md). Among them:

- Receipt anchor uses `NodeAttemptReceipt` / `HarnessRun` / `NodeRun`.
- Delegation request uses `DelegationRequest` / `DelegationReceipt` / `ACPMessage`.
- Handoff payload uses `AgentHandoff` layered object, constrained by depth / budget / data boundary.

### Token Budget Allocation Strategy

```
Total budget: 10000 tokens
├─ L1: 200 tokens (2%)
├─ L2: 500 tokens (5%)
├─ L3: 2000 tokens (20%)
└─ L4: 8000 tokens (80%)
```

### Current Implementation Status

- `src/core/agent-loop/handoff-model.ts`: Has type definitions, no actual serialization logic.
- GAP-V2-05 (Handoff four-layer protocol) pending implementation.

## Consequences

- Handoff four-layer model transforms agent-to-agent context transfer from "natural language black box" to "structured analyzable" protocol.
- Combined with OAPEFLIR Loop, agent-to-agent collaboration in the secondary chain (F→L→I→R) will benefit from this protocol.
- Future can analyze agent collaboration bottlenecks based on Handoff logs.

## Alternative Solutions

1. **Natural language summary (current implementation)**: Simple to implement, but token budget uncontrollable, semantic compression quality unstable.
2. **Only pass L1/L2**: Lower complexity without L3/L4, but lacks necessary context for complex multi-step scenarios.
3. **Full state serialization (like JSON)**: Most complete information, but high token overhead, requires schema alignment on both sides.
4. **Adopt this decision**: Four-layer model, select layer by scenario, balance information completeness and token budget.

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-060 Explicit Planning Hub](./060-explicit-planning-hub.md)
- [Agent Handoff Contract](../contracts/agent_handoff_contract.md)

## Source Sections

- `§13 OAPEFLIR / Harness Collaboration and Handoff Subsection`
- `§59 Explainability and Handoff Audit Requirements`
