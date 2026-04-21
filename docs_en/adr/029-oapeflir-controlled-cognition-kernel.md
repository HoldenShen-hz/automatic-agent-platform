# ADR-029 OAPEFLIR Controlled Cognition Kernel

- Status: Accepted
- Decision Date: 2026-04-17

## Context

OAPEFLIR is the platform's cognitive loop model, defining the eight-stage execution flow: Observe→Assess→Plan→Execute→Feedback→Learn→Improve→Release. Each stage requires clear input/output, state transitions, and quality assurance.

## Decision

### Eight-Stage Cognitive Loop

```
Observe → Assess → Plan → Execute → Feedback
              ↓                       ↓
           Feedback → Learn → Improve → Release
```

### Stage Definitions

| Stage | Input | Output | Key Components |
|-------|-------|--------|----------------|
| Observe | Raw signals | UnifiedObservation | OapeflirLoopService |
| Assess | Observation | UnifiedAssessment (complexity 5 levels) | AssessmentService |
| Plan | Assessment | ExecutionPlan + replan | PlanBuilder |
| Execute | Plan DTO | StepOutput | RuntimeExecuteBridge |
| Feedback | StepOutput | StepFeedback (6 types) | FeedbackCollector |
| Learn | Feedback | LearningObject (4 pattern types) | StrategyLearningService |
| Improve | LearningObject | ImprovementCandidate | EvolutionMvpService |
| Release | Candidate | RolloutRecord | RolloutScheduler |

### All Input/Output Zod Schema Validation

Each stage input/output must pass Zod schema validation ensuring type safety.

### Per-Stage StageRationale

```typescript
interface StageRationale {
  stage: OapeflirStage;
  rationale: string;
  timestamp: string;
}
```

### Timeline Tracking

- OTel span records each stage's duration
- StageTimeline persists stage transitions

## Consequences

Positive:
- Standardized stage definitions make system explainable
- Zod validation ensures type safety
- StageRationale facilitates problem tracing

Negative:
- Stages add execution latency
- State management complexity increases

Trade-offs:
- Visibility vs. latency
- Structure vs. flexibility

## Cross-References

- [ADR-001 Three-Layer Separation of Authority](./001-three-layer-architecture.md)
- [ADR-016 OAPEFLIR Eight-Phase Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)

## Source Sections

- `§13` OAPEFLIR Controlled Cognitive Kernel