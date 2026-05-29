# ADR-060 显式规划层vs Plan Hub

- Status：Accepted
- Decision日期：2026-04-17
- 相关：ADR-016 OAPEFLIR 八阶段认知循环模型

## Background

早期 Phase 1A/1B Architecture中，执lines计划（Plan）的生成逻辑散落在 `AgentExecutor` 内部，via隐式的"dispatch 模式"实现任务分解。这种设计存在三个Issue：

1. **不可追踪**：no显式图计划合约，no法对计划内容进lines独立验证。
2. **不可审计**：重规划（replan）Decisionno版本链，调试困难。
3. **不可复用**：Planning 策略no法在多个执linesreferences擎间共享。

OAPEFLIR Loop 模型（ADR-016）要求 Plan 作为独立 Hub，形成 Assess→Plan→Execute 的明确边界。

## Decision

### 1. 建立独立的 Plan Hub

Plan Hub 作为 OAPEFLIR 第 3 阶段（介于 Assess 和 Execute 之间），职责为：

- 接收 `UnifiedAssessment`（来自 Assess Hub）
- 输出 `Plan` DTO（作为 Execute Hub 的唯一输入）
- supported多种规划策略（linear/dag/conditional/reactive/hierarchical/multi-agent/adaptive/uncertainty-aware）
- 维护 Plan 版本链（每iterations replan 生成 version N+1）

### 2. PlanGraphBundle 核心字段

```typescript
interface PlanGraphBundle {
  planGraphBundleId: string;
  harnessRunId: string;
  graphVersion: number;      // 每iterations replan +1
  strategy: PlanStrategy;    // 8 种策略枚举
  graph: PlanGraph;          // 节点vs边
  estimatedCost: number;     // token 预估
  estimatedDuration: number; // ms 预估
  retryPolicy: RetryPolicy;
  replanTriggers?: ReplanningTrigger[];
  groundingRefs?: string[];  // 知识库references用
  contextSnapshot: ContextSnapshot;
  createdAt: string;         // ISO 8601
}
```

### 3. R3 约束mandatory执lines

| 约束 | Description |
|------|------|
| **R3-SINGLE** | Execute 层只能接收 `PlanGraphBundle`，不允许旁路 raw task directly执lines |
| **R3-BUILDER** | `WorkflowPlanner` 降级为 PlanBuilder 的data源，不directly输出执lines指令 |
| **R3-VERSION** | 每iterations replan 必须生成 version +1，不得覆盖历史版本 |
| **R3-NOBYPASS** | Execute 层必须拒绝no有效 Plan 的输入 |

### 4. Plan→Execute 桥接

via `RuntimeExecuteBridge` 接口实现 PlanGraphBundle 到执linesreferences擎的解耦：

```typescript
interface RuntimeExecuteBridge {
  executePlan(plan: PlanGraphBundle): Promise<NodeAttemptReceipt>;
  validatePlanInput(plan: PlanGraphBundle): PlanValidationResult;
}
```

Execute 层via此接口接收 Plan，不得bypassing。

### 5. 8 种规划策略

| 策略 | 适用场景 | 实现Status |
|------|---------|---------|
| `linear` | 单步骤或顺序执lines任务 | 已实现 |
| `dag` | 多步骤有relies on关系的任务 | 已实现 |
| `conditional` | 含分支判断的计划 | 部分实现 |
| `reactive` | response外部事件变化的计划 | 部分实现 |
| `hierarchical` | 多层iterations抽象的计划 | 未实现 |
| `multi-agent` | 多 Agent 协作计划 | 未实现 |
| `adaptive` | 根据执lines反馈调整计划 | 已实现（replan） |
| `uncertainty-aware` | handle不确定性的概率规划 | 未实现 |

### 6. Replanning 触发vsDecision

| 触发class型 | 条件 | 策略选择 |
|---------|------|---------|
| `tool_failure` | 工具callfailed | `reactive` + 重试 |
| `context_drift` | 上下文偏离原始意图 | `adaptive` |
| `resource_exhaustion` | 资源耗尽 | `linear` 降级 |
| `explicit_request` | user显式重规划request | `dag` |
| `time_budget_exceeded` | timebudgetexceeds限 | `hierarchical` 压缩 |
| `quality_below_threshold` | 质量低于threshold | `uncertainty-aware` |

## 备选方案

### 方案 A：维持 dispatch 隐含规划（现状）

优点：no需重构现有执linesreferences擎。
代价：Plan 不可追踪、不可审计、不可复用。

### 方案 B：Plan 作为独立 Hub（已选）

优点：清晰的阶段边界、完整的版本链、多策略可扩展。
代价：需要新增 planning/ 模块，约 1500 linescode。

## Consequences

- 新增 `src/core/planning/` 模块（约 9 文件，2000 lines）。
- `RuntimeExecuteBridge` 作为 `PlanGraphBundle -> NodeAttemptReceipt` 解耦层。

## v4.3 ADR Remediation

- A-61: 本 ADR 原先把 `Plan DTO` vs `RuntimeExecuteBridge.executePlan(plan)` 写成 P3 -> P4 唯一 handoff，Root cause: 显式规划 ADR 成型时 executable contract 还未收口到图执lines模型。修复：正文现把权威输入切到 `PlanGraphBundle`，权威输出切到 `NodeAttemptReceipt`。
- 阶段边界occurrences增加 Zod schema 验证（PlanSchema）。
- 所有重规划Decisionvia `ReplanningDecision` DTO record审计。

## 交叉references用

- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-075 六级受控发布vs Rollout Status机](./075-controlled-rollout-release.md)（ADR-018 only保留历史迁移Background）
- [ADR-072 测试策略](./072-oapeflir-testing-strategy.md)

## 来源章节

- `§5` Plan Hub 设计
- `§5.3` PlanGraphBundle defines
- `§L.4` R3 约束defines
- `§L.5` ReplanningTrigger
