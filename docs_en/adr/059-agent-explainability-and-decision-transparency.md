# ADR-059 Agent Explainability and Decision Transparency

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Regulations such as the EU AI Act require AI decisions to be explainable, and the platform needs to provide decision transparency mechanisms.

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
| Decision Tree Extraction | Extract rules from neural networks |
| Attention Visualization | Show key inputs |
| Counterfactual Analysis | "What if..." |
| Case-Based Reasoning | Similar decision references |

### Audit Logs

- All high-risk decisions are recorded
- Tamper-proof storage
- Supports querying and exporting

### Compliance Reporting

- Automatically generated compliance reports
- Supports regulatory agency review
- Periodically published transparency reports

## Consequences

Advantages:

- Meets EU AI Act and other regulatory requirements
- Improves user trust
- Facilitates problem identification and resolution

Costs:

- Explanation generation adds latency
- Increased storage costs

## Cross References

- [ADR-029 OAPEFLIR Controlled Cognition Kernel](./029-oapeflir-controlled-cognition-kernel.md)
- [ADR-066 Compliance Report Auto-Generation Engine](./066-compliance-report-auto-generation.md)

## Source Section

- `§59` Agent Explainability and Decision Transparency Architecture
