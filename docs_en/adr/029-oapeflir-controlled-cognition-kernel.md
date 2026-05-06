# ADR-029 OAPEFLIR Controlled Cognition Kernel

- Status: Accepted
- Decision Date: 2026-04-17

## Background

OAPEFLIR is the platform's cognitive loop model, defining the eight-stage cognitive process of Observe→Assess→Plan→Execute→Feedback→Learn→Improve→Release. Each stage needs clear input/output, quality assurance, and boundary with HarnessRuntime, but no longer has an independent execution runtime.

## Decision

### Eight-Stage Cognitive Loop

```
Observe → Assess → Plan → Execute → Feedback
              ↓                       ↓
           Feedback → Learn → Improve → Release
```

### Each Stage Definition

| Stage | Input | Output | Key Components |
|-------|-------|--------|---------------|
| Observe | Raw signals | CognitiveFrameInput / UnifiedObservation | ObserveAdapter |
| Assess | Observation | UnifiedAssessment (complexity 5 levels) | AssessmentService |
| Plan | Assessment | PlanRationale + `PlanGraphBundle` reference | PlanBuilder |
| Execute | `NodeAttemptReceipt` / evidence refs | ExecutionSummaryView | RuntimeExecuteBridge |
| Feedback | ExecutionSummaryView | StepFeedback (6 types) | FeedbackCollector |
| Learn | Feedback | LearningObject (4 pattern_types) | StrategyLearningService |
| Improve | LearningObject | ImprovementCandidate | EvolutionMvpService |
| Release | Candidate | ReleaseDecisionView / RolloutRecord | RolloutScheduler |

### All Input/Output Zod Schema Validation

Each stage input/output must pass Zod schema validation to ensure type safety.

### Per-Stage StageRationale

```typescript
interface StageRationale {
  stage: OapeflirStage;
  rationale: string;
  timestamp: string;
}
```

Constraints:

- `StageRationale`, `ExecutionSummaryView`, and `ReleaseDecisionView` are only allowed as `oapeflir.view.*` / `oapeflir.rationale.*` projections.
- Any real state advancement, budget change, or side effect commit must return to `HarnessRuntime` and `RuntimeStateMachine.transition(command)`.

### Timeline Tracking

- OTel span records each stage duration
- StageTimeline persists stage transitions

## Consequences

Advantages:

- Standardized stage definition makes system explainable
- Zod validation ensures type safety
- StageRationale facilitates problem tracing

Costs:

- Stages add execution latency
- State management complexity increases

## Cross References

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)
- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)

## Source Sections

- `§13` OAPEFLIR controlled cognition kernel

## v4.3 ADR Remediation

- A-2: This ADR originally wrote OAPEFLIR controlled cognition kernel as execution backbone above HarnessRuntime. The root cause was that cognitive framework and execution runtime did not have clear layering in early design. Fix: The text now converges OAPEFLIR to cognitive/interpretation layer above runtime, real execution still governed by `HarnessRuntime`.
- A-10: This ADR originally continued `Oapeflir*` style naming. The root cause was that stage DTOs were directly named by framework name. Fix: The text now changes to cognitive view objects like `CognitiveFrameInput` / `ExecutionSummaryView` / `ReleaseDecisionView`, and avoids using framework name directly as canonical DTO prefix.
