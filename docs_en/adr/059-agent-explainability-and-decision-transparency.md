# ADR-059 Agent Explainability and Decision Transparency

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Users and operators need to understand why agents make certain decisions, requiring transparent reasoning and clear explanation mechanisms.

## Decision

### Explanation Types

| Type | Audience | Content |
|------|----------|---------|
| Decision Rationale | End users | Why this decision was made |
| Execution Trace | Operators | How the decision was reached |
| Confidence Signal | Analysts | How certain the agent is |
| Alternative Options | Reviewers | What alternatives were considered |

### StageRationale

```typescript
interface StageRationale {
  stage: OapeflirStage;
  rationale: string;
  timestamp: string;
  inputs: unknown;
  outputs: unknown;
  confidence: number;
}
```

### Explainability Pipeline

- `ops-maturity/explainability/`
- Captures reasoning at each stage
- Aggregates into human-readable explanations
- Supports audit and compliance requirements

### Caching Strategy

| Cache Type | TTL | Use Case |
|------------|-----|----------|
| Short-term | 1 hour | Recent execution rationale |
| Medium-term | 24 hours | Investigation context |
| Long-term | 30 days | Compliance records |

### Visualization

- Timeline view of execution stages
- Decision tree for branching logic
- Confidence indicators for predictions
- Alternative comparison charts

## Consequences

Positive:
- Transparent reasoning builds user trust
- Audit trail supports compliance
- Debugging enables faster issue resolution

Negative:
- Explanation capture adds latency
- Storage requirements for rationale data

Trade-offs:
- Transparency vs. performance
- Detail vs. clarity

## Cross-References

- [ADR-016 OAPEFLIR Eight-Phase Cognitive Loop](./016-oapeflir-loop-model.md)
- [ADR-087 Ops Maturity Runtime](./087-ops-maturity-runtime.md)

## Source Sections

- `§59` Agent Explainability