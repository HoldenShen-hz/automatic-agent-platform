# ADR-065 工作流可视化调试器架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

Workflow 失败时开发者需要可视化工具来理解执行过程、定位问题。

## 决策

### 调试器架构

| 组件 | 说明 |
|------|------|
| Visualizer | DAG 可视化 |
| NodeInspector | 节点详情查看 |
| StateExplorer | 状态浏览器 |
| TraceViewer | 链路追踪 |
| BreakpointManager | 断点管理 |

### DAG 可视化

```typescript
interface WorkflowDAGView {
  harness_run_id: string;
  node_run_ids: string[];
  nodes: DAGNode[];
  edges: DAGEdge[];
  current_node?: string;
  breakpoints: string[];
  execution_path: string[];
}
```

## v4.3 ADR Remediation

- A-62: 本 ADR 原先把调试器锚定在 `workflow_id / current_step / StepInspector`，根因是文档承接了旧 workflow debugger 原型，没有切换到 `HarnessRun / NodeRun` 调试模型。修复：正文现把调试锚点改为 harness/node 语义。

### 调试功能

> **已废弃 step 概念**：调试模型基于 `HarnessRun / NodeRun`，不支持 `step_over/step_into/step_out` 等线性步骤调试操作。

| 功能 | 说明 |
|------|------|
| node_over | 节点跳过 |
| node_into | 节点进入 |
| node_out | 节点退出 |
| resume | 继续执行 |
| pause | 暂停 |
| stop | 停止 |

### 状态查看

- WorkflowState 完整状态
- 步骤输入输出
- 中间变量
- 错误信息

### 断点条件

| 类型 | 说明 |
|------|------|
| node_start | 节点开始 |
| node_complete | 节点完成 |
| error | 错误发生 |
| condition | 条件满足 |

### Trace 集成

- 全链路 trace
- Span 详情
- 性能剖析
- 错误链路

## 后果

优点：

- 可视化调试提高效率
- 完整状态便于问题定位
- 断点支持细粒度调试

代价：

- 调试器开发成本
- 运行时开销

## 交叉引用

- [ADR-004 工作流与路由](./004-workflow-routing.md)
- [ADR-090 Runtime、数据可靠性与运维治理](./090-runtime-data-reliability-and-operations.md)

## 来源章节

- `§65` 工作流可视化调试器架构
