# ADR-059 Agent Explainability and Decision Transparency

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Regulations like the EU AI Act require AI decisions to be explainable, and the platform needs to provide decision transparency mechanisms.

## Decision

### Decision Tracing

```typescript
interface DecisionRecord {
  decision_id: string;
  agent_id: string;
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
| what | What was done | Operator |
| why | Why it was done | Analyst |
| how | How it was done | Developer |
| full | Complete reasoning chain | Auditor |

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
- Support queries and export

### Compliance Reports

- Automatically generate compliance reports
- Support regulatory agency review
- Publish transparency reports periodically

## Consequences

Positive:

- Meet EU AI Act and other regulatory requirements
- Increase user trust
- Facilitate problem diagnosis and repair

Negative:

- Explanation generation adds latency
- Storage costs increase

## Cross-References

- [ADR-029 OAPEFLIR Controlled Cognition Kernel](./029-oapeflir-controlled-cognition-kernel.md)
- [ADR-066 Compliance Report Auto-Generation Engine](./066-compliance-report-auto-generation.md)

## Source Sections

- `§59` Agent Explainability and Decision Transparency Architecture