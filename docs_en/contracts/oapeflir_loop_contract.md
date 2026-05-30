# OAPEFLIR Loop Contract

## 1. Scope

This contract defines the OAPEFLIR eight-stage cognitive loop (`OapeflirLoopService`) cognition, governance, explanation, and release decision boundary.

OAPEFLIR is not an execution engine, does not create independent runs, and does not directly drive `HarnessRun` / `NodeRun` status transitions; it only reads runtime facts, generates cognitive conclusions, produces view / rationale / release proposal, and delegates actual execution to `HarnessRuntime`.

Related documents:
- `runtime_execution_contract.md`: Execute layer runtime integration.
- `task_and_workflow_contract.md`: Task main chain.
- `perception_contract.md`: Observe/Assess stage DTO.

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

  // Single-stage cognitive evaluation (for debugging)
  async runStage(
    stage: OapeflirStage,
    context: LoopContext
  ): Promise<StageResult>;
}
```

Rules:

- `OapeflirLoopOutput` must not carry `finalOutcome`, budget state, lease state, or any runtime truth.
- OAPEFLIR output release decision is only a proposal; actual release must go through control plane, approval, and `RuntimeStateMachine.transition(command)`.
- If execution plan needs to be appended, only `GraphPatchProposal` / `PlanGraphBundle` reference may be produced, not directly executed in loop.

### 2.2 Eight-Stage DTO Input/Output

| Stage | Input DTO | Output DTO |
|------|---------|---------| 
| Observe | `LoopContext` (inherits prior view/rationale) | `UnifiedObservation` |
| Assess | `UnifiedObservation + RuntimeEvidenceView[]` | `UnifiedAssessment` |
| Plan | `UnifiedAssessment` | `GraphPatchProposal \| PlanAdjustmentProposal` |
| Execute | `NodeAttemptReceipt[] + RuntimeEvidenceView[]` | `ExecutionStageView` |
| Feedback | `NodeAttemptReceipt[] + ExecutionStageView` | `LearningSignal[]` |
| Learn | `LearningSignal[]` | `LearningObject[]` |
| Improve | `LearningObject[]` | `ImprovementCandidate[]` |
| Release | `ImprovementCandidate[] + GovernanceDecision[]` | `ReleaseProposal[]` |

Note:

- `Plan` / `DualChannelStepOutput` / `Rollout` can only serve as legacy view input, not canonical DTO.
- Execute stage in OAPEFLIR only consumes runtime receipt view, does not own worker, lease, retry, or side effect commit.

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
- OAPEFLIR must not directly call real `AgentExecutor` / `CommandExecutor` to execute side effects through bridge.
- Bridge only allows reading `PlanGraphBundle`, `NodeAttemptReceipt`, release evidence, and related projections.
- If a stage needs to trigger re-planning or release, must generate proposal and hand to control plane.

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

- `ExecutionStageView` is a derived view of `NodeAttemptReceipt`, not a replacement for the receipt itself.
- User summary, cognitive explanation, and runtime facts must be stored in separate layers to avoid writing cognitive view back to truth.

## 5. Event Contract

| Event | Trigger | Subscribers |
|------|---------|-------|
| `oapeflir.view.stage.started` | Each stage start | OTel, diagnostics |
| `oapeflir.view.stage.completed` | Each stage completion | Feedback, Learn |
| `oapeflir.view.stage.failed` | Stage exception | Alerting, diagnostics |
| `oapeflir.view.feedback.collected` | Feedback stage completion | Learn, Improve |
| `oapeflir.view.release.proposed` | Release proposal formed | Governance, release control plane |

Rules:

- OAPEFLIR events must only belong to `oapeflir.view.*` or rationale/proposal namespaces.
- Truth events, status progression events, and writeback facts must still use `platform.*`.

## 6. LoopContext Propagation Rules

- `traceId`: runs through entire loop, used for correlating logs and trace.
- `harnessRunId`: correlates to the single run being explained/governed.
- `sessionId`: identifies multiple loops in the same user session.
- `layer`: current loop's Memory layer (L1-L6).
- `priorSummaries`: key summaries from prior loop (future migration to Handoff four-layer protocol).
- `stageViewRef`: current stage view reference, used for linking cognitive output with runtime facts.

## 7. Constraints

- Loop timeout: `loopTimeoutMs` defaults to 300000ms (5 minutes), configurable.
- Infinite loop detection: 3 consecutive plan drifts -> abort and alert.
- Graceful degradation: secondary chain (F->L->I->R) exceptions do not impact primary chain (O->A->P->Execute view) result return.
- OAPEFLIR must not write its stage results as runtime terminal state; all truth changes must be delegated to control plane and `HarnessRuntime`.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-13: This document originally wrote `OapeflirLoopService.run()` as "execute entire main chain and return `finalOutcome`" runtime entry. Root cause: early ADR-016/029 mixed cognitive loop and execution engine as the same service, causing old runtime DTOs for `Execute`/`Rollout` to be directly copied into contract. Fix: the text now explicitly states OAPEFLIR only consumes runtime facts like `PlanGraphBundle` / `NodeAttemptReceipt`, produces `oapeflir.view.*`, rationale and `ReleaseProposal`, and no longer has independent execution authority.

Mandatory rules: status transitions must go through `RuntimeStateMachine.transition(command)`; execution plan must use `PlanGraphBundle`; execution result must use `NodeAttemptReceipt`; truth event must only use `platform.*`; OAPEFLIR can only act as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.