# OAPEFLIR Loop Contract

## 1. Scope

This contract defines the interface contract, event protocol, and integration boundaries with external systems for the OAPEFLIR eight-stage cognitive loop (OapeflirLoopService).

Related documents:
- `runtime_execution_contract.md`: Execute layer runtime integration.
- `task_and_workflow_contract.md`: Task main chain.
- `perception_contract.md`: Observe/Assess stage DTOs.

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
  // Main entry: run complete eight-stage closed loop
  async run(input: OapeflirLoopInput): Promise<OapeflirLoopOutput>;

  // Single stage execution (for debugging)
  async runStage(
    stage: OapeflirStage,
    context: LoopContext
  ): Promise<StageResult>;
}
```

### 2.2 Eight-Stage DTO Input/Output

| Stage | Input DTO | Output DTO |
|------|---------|-----------|
| Observe | `LoopContext` (inherits previous round state) | `UnifiedObservation` |
| Assess | `UnifiedObservation` | `UnifiedAssessment` |
| Plan | `UnifiedAssessment` | `Plan` |
| Execute | `Plan + ExecutionContext` | `DualChannelStepOutput[]` |
| Feedback | `DualChannelStepOutput[]` | `LearningSignal[]` |
| Learn | `LearningSignal[]` | `LearningObject[]` |
| Improve | `LearningObject[]` | `ImprovementCandidate[]` |
| Rollout | `ImprovementCandidate[]` | `RolloutRecord[]` |

## 3. ExecuteBridge Interface

The Execute stage calls the real runtime through RuntimeExecuteBridge:

```typescript
interface ExecuteBridge {
  executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult>;
  executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult>;
}
```

**Constraints**:
- ExecuteBridge must call real AgentExecutor / CommandExecutor.
- Must not return hardcoded mock data (GAP-V2-01).
- Each step execution result must include `toolCallRecords` for the Feedback stage.

## 4. DualChannelStepOutput Format

```typescript
interface DualChannelStepOutput {
  stepId: string;
  userFacingResult: {
    summary: string;         // User-visible summary
    artifacts?: string[];    // Artifact references
    citations?: string[];    // Knowledge references
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

| Event | Trigger | Subscribers |
|------|---------|-------|
| `oapeflir.stage.started` | Each stage start | OTel, SLA alerting |
| `oapeflir.stage.completed` | Each stage completion | Feedback, Learn |
| `oapeflir.stage.failed` | Stage exception | Alerting, Recovery |
| `oapeflir.feedback.collected` | Feedback stage completion | Learn, Improve |
| `oapeflir.rollout.triggered` | Rollout stage completion | Deployment pipeline |

## 6. LoopContext Propagation Rules

- `traceId`: runs through the entire loop for correlating logs and traces.
- `sessionId`: identifies multiple loops within the same user session.
- `layer`: the current Memory layer where the loop resides (L1-L6).
- `priorSummaries`: key summaries from previous round of loop (future migration to Handoff four-layer protocol).

## 7. Constraints

- Loop timeout: `loopTimeoutMs` defaults to 300000ms (5 minutes), configurable.
- Infinite loop detection: 3 consecutive rounds of plan drift → abort and alert.
- Graceful degradation: secondary chain (F→L→I→R) exceptions do not affect primary chain (O→A→P→E) result return.
