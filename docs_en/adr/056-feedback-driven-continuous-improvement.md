# ADR-056 Feedback-Driven Continuous Improvement Pipeline

- Status: Accepted
- Decision Date: 2026-04-20

## Context

The platform needs to continuously learn and improve from user feedback, forming a closed-loop improvement mechanism.

## Decision

### Feedback Types

| Type | Source | Processing Method |
|------|--------|-------------------|
| explicit | User ratings/reviews | Human review |
| implicit | Usage behavior analysis | Automatic learning |
| corrective | User corrections | Pattern extraction |
| failure | Execution failures | Root cause analysis |

### Feedback Processing Flow

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

```
LearnHub → ImproveHub → P2 Release Governance Gate → Six-Level Release
     ↓           ↓                ↓                  ↓
 LearningObject  Improvement   Gate Review         Rollout
                 Candidate    (Must pass)
```

- LearnHub generates LearningObject
- ImproveHub evaluates ImprovementCandidate
- P2 Release Governance gate review (must pass to enter Release)
- Release six-level publishing (alpha/beta/stable/ga/lts/archived)

## Consequences

Benefits:

- Closed-loop improvement mechanism
- Data-driven optimization
- User participation enhances experience

Trade-offs:

- Feedback processing requires resources
- Pattern recognition accuracy depends on data volume

## Cross-references

- [ADR-079 Feedback Hub and Seven Signal Types Preprocessing](./079-feedback-hub-signals.md)
- [ADR-080 Learn Hub and Four Pattern Detectors](./080-learn-hub-pattern-detection.md)

## Source Section

- `§56` Feedback-Driven Continuous Improvement Pipeline