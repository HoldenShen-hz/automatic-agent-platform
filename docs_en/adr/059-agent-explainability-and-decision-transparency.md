# ADR-059 Agent Explainability and Decision Transparency

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Regulations like EU AI Act require AI decisions to be explainable. The platform needs to provide decision transparency mechanisms.

## Decision

### Decision Traceability

```typescript
interface DecisionRecord {
  decision_id: string;
  harnessRunId: string;
  nodeRunId: string;
  planGraphId: string;
  context: DecisionContext;
  reasoning: string;
  evidence: Evidence[];
  confidence: number;
  timestamp: string;
}
```

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

### Audit Logs

- All high-risk decisions recorded
- Tamper-proof storage
- Support querying and exporting

### Compliance Reports

- Automatically generate compliance reports
- Support regulatory agency review
- Regularly publish transparency reports

## Consequences

Pros:

- Meets EU AI Act and other regulations
- Improves user trust
- Facilitates problem identification and resolution

Cons:

- Explanation generation adds latency
- Storage costs increase

## Cross References

- [ADR-029 OAPEFLIR Controlled Cognition Kernel](./029-oapeflir-controlled-cognition-kernel.md)
- [ADR-066 Compliance Report Auto Generation Engine](./066-compliance-report-auto-generation.md)

## Source Section

- `§59` Agent Explainability and Decision Transparency Architecture