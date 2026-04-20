# OAPEFLIR Loop Contract

## 1. 范围

本 contract 定义 OAPEFLIR 八阶段认知循环（OapeflirLoopService）的接口契约、事件协议和与外部系统的集成边界。

相关文档：
- `runtime_execution_contract.md`：Execute 层 runtime 集成。
- `task_and_workflow_contract.md`：任务主链。
- `perception_contract.md`：Observe/Assess 阶段 DTO。

## 2. 核心接口

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
  // 主入口：运行完整八阶段闭环
  async run(input: OapeflirLoopInput): Promise<OapeflirLoopOutput>;

  // 单阶段执行（用于调试）
  async runStage(
    stage: OapeflirStage,
    context: LoopContext
  ): Promise<StageResult>;
}
```

### 2.2 八阶段 DTO 输入输出

| 阶段 | 输入 DTO | 输出 DTO |
|------|---------|---------|
| Observe | `LoopContext`（继承上轮状态） | `UnifiedObservation` |
| Assess | `UnifiedObservation` | `UnifiedAssessment` |
| Plan | `UnifiedAssessment` | `Plan` |
| Execute | `Plan + ExecutionContext` | `DualChannelStepOutput[]` |
| Feedback | `DualChannelStepOutput[]` | `LearningSignal[]` |
| Learn | `LearningSignal[]` | `LearningObject[]` |
| Improve | `LearningObject[]` | `ImprovementCandidate[]` |
| Rollout | `ImprovementCandidate[]` | `RolloutRecord[]` |

## 3. ExecuteBridge 接口

Execute 阶段通过 RuntimeExecuteBridge 调用真实 runtime：

```typescript
interface ExecuteBridge {
  executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult>;
  executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult>;
}
```

**约束**：
- ExecuteBridge 必须调用真实 AgentExecutor / CommandExecutor。
- 不得返回硬编码 mock 数据（GAP-V2-01）。
- 每步执行结果必须包含 `toolCallRecords` 用于 Feedback 阶段。

## 4. DualChannelStepOutput 格式

```typescript
interface DualChannelStepOutput {
  stepId: string;
  userFacingResult: {
    summary: string;         // 用户可见摘要
    artifacts?: string[];    // 产物引用
    citations?: string[];    // 知识引用
  };
  systemTelemetry: {
    durationMs: number;
    tokensUsed: number;
    modelId: string;
    toolCallRecords: ToolCallRecord[];
  };
}
```

## 5. 事件契约

| 事件 | 触发时机 | 订阅者 |
|------|---------|-------|
| `oapeflir.stage.started` | 每阶段开始 | OTel, SLA alerting |
| `oapeflir.stage.completed` | 每阶段完成 | Feedback, Learn |
| `oapeflir.stage.failed` | 阶段异常 | Alerting, Recovery |
| `oapeflir.feedback.collected` | Feedback 阶段完成 | Learn, Improve |
| `oapeflir.rollout.triggered` | Rollout 阶段完成 | Deployment pipeline |

## 6. LoopContext 传播规则

- `traceId`：贯穿全循环，用于关联日志和 trace。
- `sessionId`：标识同一用户会话中的多次 loop。
- `layer`：当前 loop 所在的 Memory 层级（L1-L6）。
- `priorSummaries`：前轮 loop 的关键摘要（未来迁移到 Handoff 四层协议）。

## 7. 约束

- Loop 超时：`loopTimeoutMs` 默认 300000ms（5 分钟），可配置。
- 死循环检测：连续 3 轮 plan drift → 中止并告警。
- 优雅降级：副链（F→L→I→R）异常不影响主链（O→A→P→E）结果返回。
