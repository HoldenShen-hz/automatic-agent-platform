# ADR-079 Feedback Hub 与七类信号预处理

- 状态：Accepted
- 决策日期：2026-04-17
- 相关：ADR-016 OAPEFLIR 八阶段认知循环模型

## 背景

OAPEFLIR Execute 阶段输出的 `DualChannelStepOutput` 需要被 Feedback Hub 收集、处理并转化为 LearningSignal。Feedback Hub 是主链（O→A→P→E）和副链（F→L→I→R）之间的关键桥梁。

设计要求支持 7 类反馈源，实现信号去重、关联和过滤的预处理，并通过 DurableEventBus 与 Learn Hub 解耦。

## 决策

### 1. 7 类反馈源

| 反馈源 | 说明 | 信号类型 |
|--------|------|---------|
| `execution_outcome` | 执行结果（成功/失败/部分成功） | `execution_success` / `execution_failure` |
| `tool_call` | 工具调用结果 | `tool_success` / `tool_failure` |
| `resource_usage` | 资源消耗（token/time/memory） | `resource_high` / `resource_normal` |
| `context_drift` | 上下文偏离检测 | `drift_detected` / `drift_corrected` |
| `user_feedback` | 用户显式反馈 | `user_correction` / `user_rejection` |
| `system_signal` | 系统级信号（健康检查、熔断） | `system_degraded` / `system_recovered` |
| `time_budget` | 时间预算消耗 | `time_warning` / `time_exceeded` |

### 2. FeedbackSignal 接口

```typescript
interface FeedbackSignal {
  signalId: string;
  taskId: string;
  executionId: string;
  kind: FeedbackSignalKind;        // 20+ enum 值
  source: FeedbackSourceType;
  payload: unknown;                // 源特定数据
  confidence: number;               // 0-1
  timestamp: string;               // ISO 8601
  metadata: Record<string, unknown>;
}

type FeedbackSignalKind =
  | 'execution_success'
  | 'execution_failure'
  | 'tool_success'
  | 'tool_failure'
  | 'resource_high'
  | 'resource_normal'
  | 'drift_detected'
  | 'drift_corrected'
  | 'user_correction'
  | 'user_rejection'
  | 'system_degraded'
  | 'system_recovered'
  | 'time_warning'
  | 'time_exceeded'
  | 'replan_triggered'
  | 'context_overflow'
  | 'quality_below_threshold'
  | 'unknown_error';
```

### 3. Feedback 接口

```typescript
interface Feedback {
  feedbackId: string;
  taskId: string;
  executionId: string;
  signals: FeedbackSignal[];       // 关联的信号列表
  aggregated: boolean;
  processedAt?: string;
  learningSignals?: LearningSignal[];
}
```

### 4. 信号预处理器（SignalPreprocessor）

```typescript
interface SignalPreprocessor {
  // 去重：同一 signalId 仅保留第一个
  dedup(signals: FeedbackSignal[]): FeedbackSignal[];

  // 关联：将相关信号聚合（如 tool_failure + resource_high → context_overflow）
  correlate(signals: FeedbackSignal[]): FeedbackSignal[];

  // 过滤：移除低置信度或已处理的信号
  filter(signals: FeedbackSignal[]): FeedbackSignal[];

  // 预处理主方法
  preprocess(signals: FeedbackSignal[]): ProcessedSignals;
}

interface ProcessedSignals {
  highPriority: FeedbackSignal[];    // 直接转发 Learn
  mediumPriority: FeedbackSignal[];  // 累积后转发
  lowPriority: FeedbackSignal[];    // 仅记录
  learningSignals: LearningSignal[];
}
```

### 5. LearningSignal 接口

```typescript
interface LearningSignal {
  signalId: string;
  type: 'pattern' | 'anomaly' | 'correction' | 'recovery';
  sourceSignals: string[];          // 关联的 FeedbackSignal IDs
  confidence: number;
  extractedKnowledge: {
    pattern?: FailurePattern;
    anomaly?: AnomalyRecord;
    correction?: UserCorrection;
    recovery?: RecoveryPlaybook;
  };
  timestamp: string;
}
```

### 6. FeedbackCollector

```typescript
interface FeedbackCollector {
  // 从 Execute 输出收集信号
  collectFromExecution(
    output: DualChannelStepOutput,
    context: ExecutionContext
  ): FeedbackSignal[];

  // 从外部系统收集信号（webhook/polling）
  collectFromExternal(source: FeedbackSourceType): Promise<FeedbackSignal[]>;

  // 聚合多个来源的信号
  aggregate(taskId: string): Promise<Feedback>;
}
```

### 7. DurableEventBus 集成

| 事件 | Tier | 说明 |
|------|------|------|
| `feedback:collected` | Tier 1 | Feedback 已收集（需要 ack） |
| `feedback:learning_signal` | Tier 1 | LearningSignal 已生成（需要 ack） |
| `feedback:processed` | Tier 2 | 信号已处理（ack 可选） |

```typescript
// domain-event-feedback-consumer.ts 订阅流程
eventBus.subscribe('execution:completed', async (event) => {
  const signals = await feedbackCollector.collectFromExecution(event.output);
  const processed = await signalPreprocessor.preprocess(signals);
  await eventBus.publish('feedback:collected', processed);
});
```

## 备选方案

### 方案 A：轮询收集信号

优点：实现简单。
代价：延迟高，资源消耗大。

### 方案 B：事件驱动 + 主动收集（已选）

优点：低延迟，信号关联能力强。
代价：需要 DurableEventBus 支持。

## 后果

- `feedback-collector.ts`（41 行）负责信号收集。
- `signal-preprocessor.ts`（239 行）负责去重/关联/过滤。
- `domain-event-feedback-consumer.ts`（206 行）订阅执行事件。
- `feedback-model.ts`（42 行）定义 Feedback 接口。
- `types/feedback-signal.ts`（25 行）定义 FeedbackSignal。
- 事件订阅需要 DurableEventBus 支持（Tier 1 可靠传递）。

## 交叉引用

- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/core/feedback/` 模块

## 来源章节

- `§7` Feedback Hub 设计
- `§7.1` 7 类反馈源
- `§7.2-7.4` FeedbackSignal / LearningSignal 接口
- `§7.5` 信号预处理
- `§7.7-7.8` 事件定义与 DurableEventBus 集成
