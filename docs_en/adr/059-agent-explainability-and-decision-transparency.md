# ADR-059 Agent Explainability and Decision Transparency

- Status: Accepted
- Decision Date: 2026-04-20

## Context

EU AI Act and other regulations require AI decision explainability. The platform needs to provide decision transparency mechanisms.

## Decision

### Decision Traceability

```typescript
interface DecisionRecord {
  decision_id: string;
  agent_id: string;
  harness_run_id: string;     // §5.5 All decisions must link to HarnessRun
  node_run_id: string;        // §5.5 Decision context node
  plan_graph_id: string;     // §5.5 Plan graph associated with decision
  context: DecisionContext;
  reasoning: string;
  evidence: Evidence[];
  confidence: number;
  timestamp: string;
}
```

Note: All DecisionRecord must link to HarnessRun via `harness_run_id` / `node_run_id` / `plan_graph_id` to satisfy §5.5 decision traceability requirements.

### Explainability Levels

| Level | Description | Audience |
|-------|-------------|----------|
| what | What was done | Operators |
| why | Why it was done | Analysts |
| how | How it was done | Developers |
| full | Complete reasoning chain | Auditors |

### Explanation Generation

| Technique | Description |
|-----------|-------------|
| Decision tree extraction | Extract rules from neural networks |
| Attention visualization | Show key inputs |
| Counterfactual analysis | "What if..." |
| Case-based reasoning | Similar decision reference |

### Audit Log

- All high-risk decisions recorded
- Tamper-proof storage
- Query and export support

### Compliance Reporting

- Automatic compliance report generation
- Support regulatory review
- Regular transparency report publication

## Consequences

Positive:

- Meet EU AI Act and other regulatory requirements
- Improve user trust
- Facilitate problem location and resolution

Negative:

- Explanation generation adds latency
- Increased storage cost

## Cross-References

- [ADR-029 OAPEFLIR Controlled Cognition Kernel](./029-oapeflir-controlled-cognition-kernel.md)
- [ADR-066 Compliance Report Auto-Generation](./066-compliance-report-auto-generation.md)

## Source Section

- `§59` Agent Explainability and Decision Transparency Architecture
