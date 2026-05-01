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
interface PlanGraphView {
  harness_run_id: string;
  node_run_ids: string[];
  nodes: PlanNode[];
  edges: PlanEdge[];
  current_node?: string;
  breakpoints: string[];
  execution_path: string[];
}
```

**说明**：调试锚点已从旧 `WorkflowDAGView/StepInspector` 更新为 `PlanGraphView/NodeRun` 模型（见 v4.3 ADR Remediation）。

## v4.3 ADR Remediation

- A-62: 本 ADR 原先把调试器锚定在 `workflow_id / WorkflowDAGView / StepInspector / step_over` 等废弃模型，根因是文档承接了旧 workflow debugger 原型，没有切换到 `PlanGraph + NodeRun` 调试模型。修复：正文已将调试锚点统一改为 harness / node 语义；断点类型从 step_* 改为 node_start / node_complete；调试功能从 step_over/step_into/step_out 改为 node_step_over/node_step_into/node_step_out。

### 调试功能

| 功能 | 说明 |
|------|------|
| node_step_over | 跳过当前 NodeRun，执行下一同级节点 |
| node_step_into | 进入 NodeRun 子图或 PlanNode 详情 |
| node_step_out | 退出当前 NodeRun 子图 |
| resume | 继续执行 |
| pause | 暂停 |
| stop | 停止 |

### 状态查看

注：§176-2056 修复——原文档引用 `WorkflowState` 作为状态查看的权威对象，但 spec §5.5 Canonical Runtime Object Map
已明确 `WorkflowState` 为非权威/legacy 用法，权威运行时对象为 `HarnessRun`（canonical run truth）和 `NodeRun`
（canonical execution truth）。调试器应查询 HarnessRun/NodeRun 而非 WorkflowState。

- HarnessRun 完整状态（canonical run truth）
- NodeRun 节点级状态（canonical execution truth）
- 步骤输入输出（legacy step 投影，仅用于向后兼容）

### 断点条件

| 类型 | 说明 |
|------|------|
| node_start | NodeRun 开始 |
| node_complete | NodeRun 完成 |
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
