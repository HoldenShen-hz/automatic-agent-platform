# OAPEFLIR Loop Contract

## 1. Scope

This contract defines the interface contract, event protocol, and integration boundaries with external systems for the OAPEFLIR eight-phase cognitive loop (OapeflirLoopService).

Related documents:
- `runtime_execution_contract.md`: Execute layer runtime integration.
- `task_and_workflow_contract.md`: Task main chain.
- `perception_contract.md`: Observe/Assess phase DTO.

## 2. Core Interfaces

### 2.1 OapeflirLoopService

```typescript
interface OapeflirLoopInput {
  taskId: string;
  sessionId: string;
  agentId: string;
  initialObservation: UnifiedObservation;
  executionContext: ExecutionContext;
}

interface OapeflirLoopOutput {
  taskId: string;
  finalOutcome: ExecutionOutcome;
  feedbackSignals: LearningSignal[];
  improvementCandidates: ImprovementCandidate[];
  rolloutRecords: RolloutRecord[];
  loopStats: {
    stageDurationsMs: Record<string, number>;
    totalDurationMs: number;
    iterations: number;
  };
}

class OapeflirLoopService {
  // Main entry: Run complete eight-phase closed loop
  async run(input: OapeflirLoopInput): Promise<OapeflirLoopOutput>;

  // Single stage execution (for debugging)
  async runStage(
    stage: OapeflirStage,
    context: LoopContext
  ): Promise<StageResult>;
}
```

### 2.2 Eight-Phase DTO Input/Output

| Phase | Input DTO | Output DTO |
|-------|-----------|-------------|
| Observe | `LoopContext` (inherits prior state) | `UnifiedObservation` |
| Assess | `UnifiedObservation` | `UnifiedAssessment` |
| Plan | `UnifiedAssessment` | `Plan` |
| Execute | `Plan + ExecutionContext` | `DualChannelStepOutput[]` |
| Feedback | `DualChannelStepOutput[]` | `LearningSignal[]` |
| Learn | `LearningSignal[]` | `LearningObject[]` |
| Improve | `LearningObject[]` | `ImprovementCandidate[]` |
| Rollout | `ImprovementCandidate[]` | `RolloutRecord[]` |

## 3. ExecuteBridge Interface

Execute phase calls real runtime through RuntimeExecuteBridge:

```typescript
interface ExecuteBridge {
  executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult>;
  executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult>;
}
```

**Constraints**:
- ExecuteBridge must call real AgentExecutor/CommandExecutor.
- Must not return hardcoded mock data (GAP-V2-01).
- Each step execution result must include `toolCallRecords` for Feedback phase.

## 4. DualChannelStepOutput Format

```typescript
interface DualChannelStepOutput {
  stepId: string;
  userFacingResult: {
    summary: string;         // User-visible summary
    artifacts?: string[];    // Artifact references
    citations?: string[];    // Knowledge citations
  };
  systemTelemetry: {
    durationMs: number;
    tokensUsed: number;
    modelId: string;
    toolCallRecords: ToolCallRecord[];
  };
}
```

## 5. Event Contract

| Event | Trigger Timing | Subscriber |
|-------|---------------|------------|
| `oapeflir.stage.started` | Each stage start | OTel, SLA alerting |
| `oapeflir.stage.completed` | Each stage completion | Feedback, Learn |
| `oapeflir.stage.failed` | Stage exception | Alerting, Recovery |
| `oapeflir.feedback.collected` | Feedback stage completion | Learn, Improve |
| `oapeflir.rollout.triggered` | Rollout stage completion | Deployment pipeline |

## 6. LoopContext Propagation Rules

- `traceId`: Runs through entire loop, used for correlating logs and traces.
- `sessionId`: Identifies multiple loops in the same user session.
- `layer`: Current loop's Memory layer (L1-L6).
- `priorSummaries`: Key summaries from prior loop (future migration to Handoff four-layer protocol).

## 7. Constraints

- Loop timeout: `loopTimeoutMs` default 300000ms (5 minutes), configurable.
- Infinite loop detection: 3 consecutive rounds of plan drift → abort and alert.
- Graceful degradation: Secondary chain (F→L→I→R) exception does not affect primary chain (O→A→P→E) result return.
