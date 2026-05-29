# OAPEFLIR Loop Contract

## 1. 范围

本 contract defines OAPEFLIR 八阶段认知循环（`OapeflirLoopService`）的认知、治理、解释vs release Decision边界。

OAPEFLIR 不is执linesreferences擎，不创建独立 run，不directly驱动 `HarnessRun` / `NodeRun` Status迁移；它只读取运lines时事实、生成认知Conclusion、产出 view / rationale / release proposal，并把真正的执lines交给 `HarnessRuntime`。

相关文档：
- `runtime_execution_contract.md`：Execute 层 runtime 集成。
- `task_and_workflow_contract.md`：任务主链。
- `perception_contract.md`：Observe/Assess 阶段 DTO。

## 2. 核心接口

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
  // 主入口：运lines完整八阶段认知/治理闭环
  async run(input: OapeflirLoopInput): Promise<OapeflirLoopOutput>;

  // 单阶段认知求值（used for调试）
  async runStage(
    stage: OapeflirStage,
    context: LoopContext
  ): Promise<StageResult>;
}
```

规则：

- `OapeflirLoopOutput` 不得承载 `finalOutcome`、budget state、lease state 或任何 runtime truth。
- OAPEFLIR 输出的 release Decision只is一种 proposal；真正放lines必须via控制平面、审批vs `RuntimeStateMachine.transition(command)`。
- 若需要追加执lines计划，只能产出 `GraphPatchProposal` / `PlanGraphBundle` references用，不能在 loop 中directly执lines。

### 2.2 八阶段 DTO 输入输出

| 阶段 | 输入 DTO | 输出 DTO |
|------|---------|---------|
| Observe | `LoopContext`（继承上轮 view/rationale） | `UnifiedObservation` |
| Assess | `UnifiedObservation + RuntimeEvidenceView[]` | `UnifiedAssessment` |
| Plan | `UnifiedAssessment` | `GraphPatchProposal \| PlanAdjustmentProposal` |
| Execute | `NodeAttemptReceipt[] + RuntimeEvidenceView[]` | `ExecutionStageView` |
| Feedback | `NodeAttemptReceipt[] + ExecutionStageView` | `LearningSignal[]` |
| Learn | `LearningSignal[]` | `LearningObject[]` |
| Improve | `LearningObject[]` | `ImprovementCandidate[]` |
| Release | `ImprovementCandidate[] + GovernanceDecision[]` | `ReleaseProposal[]` |

Description：

- `Plan` / `DualChannelStepOutput` / `Rollout` only能作为 legacy 视图输入，不再is canonical DTO。
- Execute 阶段在 OAPEFLIR 里只消费运lines时回执视图，不拥有 worker、lease、retry 或 side effect commit。

## 3. RuntimeEvidenceBridge 接口

OAPEFLIR via只读 bridge 消费真实 runtime 事实：

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

**约束**：
- OAPEFLIR 不得via bridge directlycall真实 `AgentExecutor` / `CommandExecutor` 执lines副作用。
- bridge 只允许读取 `PlanGraphBundle`、`NodeAttemptReceipt`、release evidence vs相关投影。
- 若某阶段需要触发重新规划或 release，必须生成 proposal 并交给控制平面handle。

## 4. Stage View 格式

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

规则：

- `ExecutionStageView` is `NodeAttemptReceipt` 的派生 view，不替代回执本身。
- user摘要、认知解释和运lines时事实必须分层存放，避免把认知 view 重新写回 truth。

## 5. 事件契约

| 事件 | 触发时机 | 订阅者 |
|------|---------|-------|
| `oapeflir.view.stage.started` | 每阶段开始 | OTel, diagnostics |
| `oapeflir.view.stage.completed` | 每阶段完成 | Feedback, Learn |
| `oapeflir.view.stage.failed` | 阶段异常 | Alerting, diagnostics |
| `oapeflir.view.feedback.collected` | Feedback 阶段完成 | Learn, Improve |
| `oapeflir.view.release.proposed` | Release proposal 形成 | Governance, release control plane |

规则：

- OAPEFLIR 事件只允许belongs to `oapeflir.view.*` 或 rationale/proposal 命名空间。
- 真相事件、Status推进事件和 writeback 事实仍然必须uses `platform.*`。

## 6. LoopContext 传播规则

- `traceId`：贯穿全循环，used for关联日志和 trace。
- `harnessRunId`：关联被解释/被治理的唯一 run。
- `sessionId`：标识同一user会话中的多iterations loop。
- `layer`：当前 loop 所在的 Memory 层级（L1-L6）。
- `priorSummaries`：前轮 loop 的关键摘要（未来迁移到 Handoff 四层协议）。
- `stageViewRef`：当前阶段 view references用，used for串联认知输出vs runtime 事实。

## 7. 约束

- Loop timeout：`loopTimeoutMs` defaults to 300000ms（5 分钟），可configure。
- 死循环检测：连续 3 轮 plan drift → 中止并告警。
- 优雅降级：副链（F→L→I→R）异常不Impact主链（O→A→P→Execute view）结果返回。
- OAPEFLIR 不得把自己的阶段结果写成 runtime 终态；所有 truth change 只能委托控制平面和 `HarnessRuntime`。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-13: 本文原先把 `OapeflirLoopService.run()` 写成“执lines整条主链并返回 `finalOutcome`”的 runtime 入口，Root cause: 早期 ADR-016/029 把认知循环和执linesreferences擎混成同一服务，导致 `Execute`/`Rollout` 的旧 runtime DTO 被directly抄进 contract。修复：正文现明确 OAPEFLIR 只消费 `PlanGraphBundle` / `NodeAttemptReceipt` 等运lines时事实，产出 `oapeflir.view.*`、rationale vs `ReleaseProposal`，不再拥有独立执lines权。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
