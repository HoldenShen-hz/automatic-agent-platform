# ADR-029 OAPEFLIR Controlled Cognition Kernel

- Status: Accepted
- Decision Date: 2026-04-17

## Context

OAPEFLIR is the platform's cognitive loop model, defining an eight-stage cognitive process: Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release. Each stage requires clearly defined inputs/outputs, quality assurance, and boundaries with HarnessRuntime, but no longer has an independent execution runtime.

## Decision

### Eight-Stage Cognitive Loop

```
Observe → Assess → Plan → Execute → Feedback
              ↓                       ↓
           Feedback → Learn → Improve → Release
```

### Stage Definitions

| Stage | Input | Output | Key Component |
|-------|-------|--------|---------------|
| Observe | Raw signals | CognitiveFrameInput / UnifiedObservation | ObserveAdapter |
| Assess | Observation | UnifiedAssessment (complexity level 5) | AssessmentService |
| Plan | Assessment | PlanRationale + `PlanGraphBundle` reference | PlanBuilder |
| Execute | `NodeAttemptReceipt` / evidence refs | ExecutionSummaryView | RuntimeExecuteBridge |
| Feedback | ExecutionSummaryView | StepFeedback (6 types) | FeedbackCollector |
| Learn | Feedback | LearningObject (4 pattern_types) | StrategyLearningService |
| Improve | LearningObject | ImprovementCandidate | EvolutionMvpService |
| Release | Candidate | ReleaseDecisionView / RolloutRecord | RolloutScheduler |

### All Input/Output Zod Schema Validation

Each stage's input/output must pass Zod schema validation to ensure type safety.

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
- Any real state progression, budget changes, or side effect commits must return to `HarnessRuntime` and `RuntimeStateMachine.transition(command)`.

### Timeline Tracking

- OTel span records time spent in each stage
- StageTimeline persists stage transitions

## Consequences

Benefits:

- Standardized stage definitions make the system explainable
- Zod validation ensures type safety
- StageRationale facilitates problem tracing

Trade-offs:

- Stages add execution latency
- State management complexity increases

## Cross-references

- [ADR-001 Three-Layer Architecture](./001-three-layer-architecture.md)
- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)

## Source Section

- `§13` OAPEFLIR Controlled Cognition Kernel

## v4.3 ADR Remediation

- A-2: This ADR originally described the OAPEFLIR controlled cognition kernel as the execution backbone above HarnessRuntime. The root cause was that the cognitive framework and execution runtime were not clearly layered in early design. Fix: The text now converges OAPEFLIR to a cognitive/interpretation layer above the runtime, with actual execution still governed by `HarnessRuntime`.
- A-10: This ADR originally continued the `Oapeflir*` style naming. The root cause was that stage DTOs were directly named after the framework. Fix: The text now uses cognitive view objects like `CognitiveFrameInput` / `ExecutionSummaryView` / `ReleaseDecisionView`, avoiding using the framework name as a canonical DTO prefix.
