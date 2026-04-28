# ADR-030 Runtime 执行面

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

执行面（P4）是 Agent 实际执行任务的地方，需要统一的执行策略、注册机制、恢复机制和运行时模式。

## 决策

### ExecutionStrategy

```typescript
interface ExecutionStrategy {
  retry: {
    max_attempts: number;
    base_delay_ms: number;
    max_delay_ms: number;
  };
  timeout: {
    default_ms: number;
    by_node_kind: {
      llm_node_ms: number;
      tool_node_ms: number;
      hitl_node_ms: null;
    };
  };
  failure: {
    continue_on_failure: boolean;
    partial_success_threshold: number;
  };
  checkpoint: {
    enabled: boolean;
    interval_nodes: number;
  };
}
```

状态与恢复边界：

- 所有 truth 状态推进必须通过 `RuntimeStateMachine.transition(command)`。
- repository / recovery worker 不得直接改写 `harness_runs / node_runs / node_attempts` 的状态列来表达开始、阻塞、成功或失败。
- 恢复动作只能基于 `NodeAttemptReceipt`、lease、checkpoint 和 evidence refs 决定下一步，再经 `RuntimeStateMachine.transition(command)` 落真相。

### ExecutorRegistry

- register() 注册执行器
- resolve() 根据类型解析执行器
- plugin-executor 实现

### 6 种内建执行器类型

| 类型 | 说明 |
|------|------|
| ToolExecutor | 工具调用执行器 |
| PluginExecutor | 插件执行器 |
| BrowserExecutor | 浏览器自动化执行器 |
| SubWorkflowExecutor | 子工作流执行器 |
| CodeExecutor | 代码执行器 |
| HttpExecutor | HTTP 请求执行器 |

### 8 种运行时模式

与 PolicyMode 8 种模式对应，由 PolicyCenterService 统一管理。

### 6 种恢复 Worker

| Worker | 职责 |
|--------|------|
| RuntimeRecoveryService | 通用恢复逻辑 |
| RuntimeRepairService | 修复损坏状态 |
| RuntimeRecoveryDecisionService | 恢复决策 |
| RuntimeRecoveryReplayService | 重放执行 |
| StalledExecutionEscalationService | 卡死升级 |
| ExecutionDbQueueDisconnectRepairService | 队列断连修复 |

## 后果

优点：

- 统一执行策略简化开发
- ExecutorRegistry 支持扩展
- 6 种恢复 worker 实现自愈

代价：

- 执行层增加抽象复杂度
- 恢复逻辑需要精心设计

## 交叉引用

- [ADR-004 工作流与路由](./004-workflow-routing.md)
- [ADR-025 稳定性架构](./025-stability-architecture-seven-layers.md)

## 来源章节

- `§14` Runtime Execution Plane

## v4.3 ADR Remediation

- A-3: 本 ADR 原先只描述执行器、恢复 worker 和执行策略，没有把 `RuntimeStateMachine.transition(command)` 写成唯一状态变化入口，根因是执行 ADR 沿用了 execution-centric repository 思路。修复：正文现补入状态与恢复边界，明确所有 truth 状态推进都必须经状态机。
- A-11: 本 ADR 原先把 timeout 简化成 `default_ms / per_step_ms`，根因是执行策略仍停留在统一 step 超时模型，没有随着 `NodeRun` 类型分化引入按节点类型动态超时。修复：正文现把 timeout 改为 `by_node_kind`，显式区分 LLM / tool / HITL 节点。
