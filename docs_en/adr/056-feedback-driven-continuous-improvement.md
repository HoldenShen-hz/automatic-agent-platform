# ADR-056 Feedback-Driven Continuous Improvement Pipeline

- Status: Accepted
- Decision Date: 2026-04-20

## Context

The platform needs to continuously learn and improve from user feedback, forming a closed-loop improvement mechanism.

## Decision

### Feedback Types

| Type | Source | Processing Method |
|------|--------|------------------|
| explicit | User ratings/reviews | Manual review |
| implicit | Usage behavior analysis | Automatic learning |
| corrective | User corrections | Pattern extraction |
| failure | Execution failure | Root cause analysis |

### Feedback Processing Pipeline

```
Feedback Collection → Preprocessing → Classification → Pattern Recognition → Learning Object Generation → Improvement Candidate Evaluation → Rollout
```

### FeedbackHub

- `FeedbackHub` collects 7 types of signals
- `FeedbackCollector` preprocessing
- `StrategyLearningService` pattern detection

### Learning Objects

```typescript
interface LearningObject {
  object_id: string;
  learning_type: LearningType;
  pattern: string;
  evidence: FeedbackEvidence[];
  confidence: number;
}
```

### Improvement Pipeline

- LearnHub generates LearningObject
- ImproveHub evaluates ImprovementCandidate
- Release six-level release (must pass P2 Release Governance gate)

Note: §13.1 explicitly states that Release is a P2 decision, not OAPEFLIR self-release. The Release phase in the Learn→Improve→Release pipeline must go through P2 Release Governance gate review, and cannot be skipped.

## Consequences

Pros:

- Closed-loop improvement mechanism
- Data-driven optimization
- User participation improves experience

Cons:

- Feedback processing requires resources
- Pattern recognition accuracy depends on data volume

## Cross-references

- [ADR-079 Feedback Hub and Seven Signal Types Preprocessing](./079-feedback-hub-signals.md)
- [ADR-080 Learn Hub and Four Pattern Detectors](./080-learn-hub-pattern-detection.md)

## Source Section

- `§56` Feedback-Driven Continuous Improvement Pipeline
