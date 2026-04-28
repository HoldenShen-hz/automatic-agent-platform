# OAPEFLIR Loop Contract

## 1. 范围

本 contract 定义 OAPEFLIR 八阶段认知循环（`OapeflirLoopService`）的认知、治理、解释与 release 决策边界。

OAPEFLIR 不是执行引擎，不创建独立 run，不直接驱动 `HarnessRun` / `NodeRun` 状态迁移；它只读取运行时事实、生成认知结论、产出 view / rationale / release proposal，并把真正的执行交给 `HarnessRuntime`。

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
  // 主入口：运行完整八阶段认知/治理闭环
  async run(input: OapeflirLoopInput): Promise<OapeflirLoopOutput>;

  // 单阶段认知求值（用于调试）
  async runStage(
    stage: OapeflirStage,
    context: LoopContext
  ): Promise<StageResult>;
}
```

规则：

- `OapeflirLoopOutput` 不得承载 `finalOutcome`、budget state、lease state 或任何 runtime truth。
- OAPEFLIR 输出的 release 决策只是一种 proposal；真正放行必须通过控制平面、审批与 `RuntimeStateMachine.transition(command)`。
- 若需要追加执行计划，只能产出 `GraphPatchProposal` / `PlanGraphBundle` 引用，不能在 loop 中直接执行。

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

说明：

- `Plan` / `DualChannelStepOutput` / `Rollout` 仅能作为 legacy 视图输入，不再是 canonical DTO。
- Execute 阶段在 OAPEFLIR 里只消费运行时回执视图，不拥有 worker、lease、retry 或 side effect commit。

## 3. RuntimeEvidenceBridge 接口

OAPEFLIR 通过只读 bridge 消费真实 runtime 事实：

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
- OAPEFLIR 不得通过 bridge 直接调用真实 `AgentExecutor` / `CommandExecutor` 执行副作用。
- bridge 只允许读取 `PlanGraphBundle`、`NodeAttemptReceipt`、release evidence 与相关投影。
- 若某阶段需要触发重新规划或 release，必须生成 proposal 并交给控制平面处理。

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

- `ExecutionStageView` 是 `NodeAttemptReceipt` 的派生 view，不替代回执本身。
- 用户摘要、认知解释和运行时事实必须分层存放，避免把认知 view 重新写回 truth。

## 5. 事件契约

| 事件 | 触发时机 | 订阅者 |
|------|---------|-------|
| `oapeflir.view.stage.started` | 每阶段开始 | OTel, diagnostics |
| `oapeflir.view.stage.completed` | 每阶段完成 | Feedback, Learn |
| `oapeflir.view.stage.failed` | 阶段异常 | Alerting, diagnostics |
| `oapeflir.view.feedback.collected` | Feedback 阶段完成 | Learn, Improve |
| `oapeflir.view.release.proposed` | Release proposal 形成 | Governance, release control plane |

规则：

- OAPEFLIR 事件只允许属于 `oapeflir.view.*` 或 rationale/proposal 命名空间。
- 真相事件、状态推进事件和 writeback 事实仍然必须使用 `platform.*`。

## 6. LoopContext 传播规则

- `traceId`：贯穿全循环，用于关联日志和 trace。
- `harnessRunId`：关联被解释/被治理的唯一 run。
- `sessionId`：标识同一用户会话中的多次 loop。
- `layer`：当前 loop 所在的 Memory 层级（L1-L6）。
- `priorSummaries`：前轮 loop 的关键摘要（未来迁移到 Handoff 四层协议）。
- `stageViewRef`：当前阶段 view 引用，用于串联认知输出与 runtime 事实。

## 7. 约束

- Loop 超时：`loopTimeoutMs` 默认 300000ms（5 分钟），可配置。
- 死循环检测：连续 3 轮 plan drift → 中止并告警。
- 优雅降级：副链（F→L→I→R）异常不影响主链（O→A→P→Execute view）结果返回。
- OAPEFLIR 不得把自己的阶段结果写成 runtime 终态；所有 truth change 只能委托控制平面和 `HarnessRuntime`。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-13: 本文原先把 `OapeflirLoopService.run()` 写成“执行整条主链并返回 `finalOutcome`”的 runtime 入口，根因是早期 ADR-016/029 把认知循环和执行引擎混成同一服务，导致 `Execute`/`Rollout` 的旧 runtime DTO 被直接抄进 contract。修复：正文现明确 OAPEFLIR 只消费 `PlanGraphBundle` / `NodeAttemptReceipt` 等运行时事实，产出 `oapeflir.view.*`、rationale 与 `ReleaseProposal`，不再拥有独立执行权。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
