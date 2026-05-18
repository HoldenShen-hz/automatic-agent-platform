# OAPEFLIR Loop Contract

## 1. Scope

This contract defines the OAPEFLIR eight-stage cognitive loop (`OapeflirLoopService`) boundaries for cognition, governance, explanation, and release decision.

OAPEFLIR is not an execution engine, does not create independent runs, and does not directly drive `HarnessRun` / `NodeRun` state transitions; it only reads runtime facts, generates cognitive conclusions, produces view / rationale / release proposals, and delegates actual execution to `HarnessRuntime`.

Related documents:
- `runtime_execution_contract.md`: Execute layer runtime integration.
- `task_and_workflow_contract.md`: Task main chain.
- `perception_contract.md`: Observe/Assess stage DTOs.

## 2. Core Interface

### 2.1 OapeflirLoopService

```typescript
interface OapeflirLoopInput {
  harnessRunId: string;
  planGraphBundleId?: string;
  graphVersion?: number;
  sessionId?: string;
  operatorId?: string;
  initialObservation: UnifiedObservation;
  runtimeEvidenceRefs: string[];
  rationaleContext: CognitiveFrameInput;
}

interface OapeflirLoopOutput {
  harnessRunId: string;
  latestStageViewRef: string;
  rationaleRefs: string[];
  feedbackSignals: LearningSignal[];
  learningObjects: LearningObject[];
  improvementCandidates: ImprovementCandidate[];
  releaseProposals: ReleaseProposal[];
  loopStats: {
    stageDurationsMs: Record<string, number>;
    totalDurationMs: number;
    iterations: number;
  };
}

class OapeflirLoopService {
  // Main entry: run complete eight-stage cognitive/governance loop
  async run(input: OapeflirLoopInput): Promise<OapeflirLoopOutput>;

  // Single stage cognitive evaluation (for debugging)
  async runStage(
    stage: OapeflirStage,
    context: LoopContext
  ): Promise<StageResult>;
}
```

Rules:

- `OapeflirLoopOutput` must not carry `finalOutcome`, budget state, lease state, or any runtime truth.
- OAPEFLIR output release decisions are only proposals; actual release must go through the control plane, approval, and `RuntimeStateMachine.transition(command)`.
- If execution plan needs to be appended, only `GraphPatchProposal` / `PlanGraphBundle` references may be produced; execution must not occur directly in the loop.

### 2.2 Eight-Stage DTO Input/Output

| Stage | Input DTO | Output DTO |
|------|---------|---------|
| Observe | `LoopContext` (inherits previous round view/rationale) | `UnifiedObservation` |
| Assess | `UnifiedObservation + RuntimeEvidenceView[]` | `UnifiedAssessment` |
| Plan | `UnifiedAssessment` | `GraphPatchProposal \| PlanAdjustmentProposal` |
| Execute | `NodeAttemptReceipt[] + RuntimeEvidenceView[]` | `ExecutionStageView` |
| Feedback | `NodeAttemptReceipt[] + ExecutionStageView` | `LearningSignal[]` |
| Learn | `LearningSignal[]` | `LearningObject[]` |
| Improve | `LearningObject[]` | `ImprovementCandidate[]` |
| Release | `ImprovementCandidate[] + GovernanceDecision[]` | `ReleaseProposal[]` |

Notes:

- `Plan` / `DualChannelStepOutput` / `Rollout` may only serve as legacy view inputs, no longer canonical DTOs.
- Execute stage within OAPEFLIR only consumes runtime receipt views and does not own workers, leases, retries, or side effect commits.

## 3. RuntimeEvidenceBridge Interface

OAPEFLIR consumes real runtime facts through a read-only bridge:

```typescript
interface RuntimeEvidenceBridge {
  listAttemptReceipts(
    harnessRunId: string,
    options?: { graphVersion?: number }
  ): Promise<NodeAttemptReceipt[]>;

  loadPlanGraphBundle(planGraphBundleId: string): Promise<PlanGraphBundle>;

  loadReleaseEvidence(harnessRunId: string): Promise<ReleaseEvidenceView>;
}
```

**Constraints**:
- OAPEFLIR must not directly call real `AgentExecutor` / `CommandExecutor` to execute side effects through the bridge.
- The bridge only permits reading `PlanGraphBundle`, `NodeAttemptReceipt`, release evidence, and related projections.
- If a stage needs to trigger replanning or release, it must generate a proposal and delegate to the control plane.

## 4. Stage View Format

```typescript
interface ExecutionStageView {
  harnessRunId: string;
  graphVersion?: number;
  stage: "execute";
  receiptRefs: string[];
  userFacingSummary: {
    summary: string;
    artifacts?: string[];
    citations?: string[];
  };
  rationaleSummary: {
    decision: string;
    evidenceRefs: string[];
    riskNotes?: string[];
  };
}
```

Rules:

- `ExecutionStageView` is a derived view of `NodeAttemptReceipt` and does not replace the receipt itself.
- User summary, cognitive explanation, and runtime facts must be stored in separate layers to avoid writing cognitive views back to truth.

## 5. Event Contract

| Event | Trigger | Subscribers |
|------|---------|-------|
| `oapeflir.view.stage.started` | Each stage begins | OTel, diagnostics |
| `oapeflir.view.stage.completed` | Each stage completes | Feedback, Learn |
| `oapeflir.view.stage.failed` | Stage exception | Alerting, diagnostics |
| `oapeflir.view.feedback.collected` | Feedback stage completes | Learn, Improve |
| `oapeflir.view.release.proposed` | Release proposal formed | Governance, release control plane |

Rules:

- OAPEFLIR events must only belong to `oapeflir.view.*` or rationale/proposal namespaces.
- Truth events, state transition events, and writeback facts must still use `platform.*`.

## 6. LoopContext Propagation Rules

- `traceId`: runs through entire loop, used to correlate logs and traces.
- `harnessRunId`: correlates the unique run being explained/governed.
- `sessionId`: identifies multiple loops within the same user session.
- `layer`: the current Memory layer of the loop (L1-L6).
- `priorSummaries`: key summaries from previous loop rounds (future migration to Handoff four-layer protocol).
- `stageViewRef`: current stage view reference, used to chain cognitive output with runtime facts.

## 7. Constraints

- Loop timeout: `loopTimeoutMs` defaults to 300000ms (5 minutes), configurable.
- Infinite loop detection: 3 consecutive plan drift rounds -> abort and alert.
- Graceful degradation: secondary chain (F→L→I→R) exceptions do not affect primary chain (O→A→P→Execute view) result return.
- OAPEFLIR must not write its stage results as runtime terminal states; all truth changes must be delegated to the control plane and `HarnessRuntime`.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-13: This document originally wrote `OapeflirLoopService.run()` as a runtime entry that "executes the entire primary chain and returns `finalOutcome`". Root cause: early ADR-016/029 mixed the cognitive loop and execution engine into the same service, causing the old runtime DTOs of `Execute`/`Rollout` to be directly copied into the contract. Fix: The body now explicitly states that OAPEFLIR only consumes runtime facts like `PlanGraphBundle` / `NodeAttemptReceipt`, produces `oapeflir.view.*`, rationale, and `ReleaseProposal`, and no longer owns independent execution rights.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plan must use `PlanGraphBundle`; execution result must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only be `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.