# Workflow Debugger Contract

## 1. 范围

本 contract 定义 `§65` 的执行流调试、断点 API 和运行对比。调试对象为 HarnessRun、NodeRun 和 PlanGraphBundle。

相关文档：
- `runtime_state_machine_contract.md`
- `node-run-attempt-receipt-contract.md`
- `typed_event_bus_contract.md`

## 2. Canonical 对象

- `WorkflowTraceFrame` — 运行时轨迹帧
- `BreakpointDefinition` — 断点定义
- `BreakpointHit` — 断点触发记录
- `RunComparisonReport` — 运行对比报告
- `HarnessRunSnapshot` — HarnessRun 时刻快照
- `NodeRunTrace` — NodeRun 执行轨迹
- `PlanGraphDiff` — 计划图差异

## 3. `BreakpointDefinition` 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `breakpoint_id` | `string` | 断点唯一标识 |
| `harness_run_id` | `string` | 关联的 HarnessRun（断点锚点根） |
| `node_run_id?` | `string?` | 关联的 NodeRun（可选，精确到节点） |
| `node_selector` | `string?` | PlanGraph 节点选择器（用于跨 NodeRun 批量断点） |
| `condition` | `string?` | 条件表达式，满足时触发 |
| `action` | `pause \| snapshot \| compare` | 触发动作 |
| `created_at` | `timestamp` | 创建时间 |
| `created_by` | `string?` | 创建者 |

规则：
- `harness_run_id` 是断点的权威锚点，不可为空。
- `node_run_id` 用于精确断点；`node_selector` 用于批量断点。两者互斥。
- 断点必须关联到具体的 NodeRun 状态，不得使用 workflow/step 旧术语。

## 4. `WorkflowTraceFrame` 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `frame_id` | `string` | 帧唯一标识 |
| `harness_run_id` | `string` | 关联的 HarnessRun |
| `node_run_id?` | `string?` | 关联的 NodeRun |
| `plan_graph_id?` | `string?` | 关联的 PlanGraph |
| `stage` | `string` | OAPEFLIR stage |
| `loop_iteration` | `number` | 第几轮循环 |
| `status` | `string` | 触发时状态 |
| `input_snapshot` | `json` | 触发时输入快照 |
| `output_snapshot` | `json?` | 触发时输出快照（如已执行） |
| `timestamp` | `timestamp` | 帧时间戳 |
| `trace_id` | `string?` | 链路追踪 ID |

## 5. `HarnessRunSnapshot` 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `harness_run_id` | `string` | HarnessRun 标识 |
| `plan_graph_bundle_id` | `string` | PlanGraphBundle 标识 |
| `status` | `HarnessRunStatus` | 当前状态 |
| `current_stage` | `string` | 当前 OAPEFLIR stage |
| `loop_iteration` | `number` | 当前循环轮次 |
| `node_runs` | `NodeRunTrace[]` | 节点运行轨迹 |
| `budget_spent_usd` | `number?` | 已消耗预算 |
| `created_at` | `timestamp` | 创建时间 |
| `completed_at` | `timestamp?` | 完成时间（如已结束） |

## 6. `NodeRunTrace` 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `node_run_id` | `string` | NodeRun 标识 |
| `node_id` | `string` | PlanGraph 节点 ID |
| `status` | `NodeRunStatus` | 节点状态 |
| `attempt_count` | `number` | 尝试次数 |
| `receipt_id?` | `string?` | NodeAttemptReceipt ID（如有） |
| `started_at` | `timestamp` | 开始时间 |
| `completed_at` | `timestamp?` | 完成时间 |
| `error?` | `string?` | 错误信息（如失败） |

## 7. `PlanGraphDiff` 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `diff_id` | `string` | 差异唯一标识 |
| `base_harness_run_id` | `string` | 对比基准 HarnessRun |
| `target_harness_run_id` | `string` | 对比目标 HarnessRun |
| `added_nodes` | `string[]` | 新增节点 ID 列表 |
| `removed_nodes` | `string[]` | 删除节点 ID 列表 |
| `modified_nodes` | `{ nodeId: string; field: string; old: unknown; new: unknown }[]` | 修改字段 |
| `added_edges` | `string[]` | 新增边 ID 列表 |
| `removed_edges` | `string[]` | 删除边 ID 列表 |
| `graph_version_delta` | `string` | 图版本增量（如 "v1->v2"） |

## 8. 规则

- 调试动作不得改变业务输出的 authoritative 事实记录。
- 比较报告必须基于可重放证据（NodeAttemptReceipt + PlanGraphBundle），而不是 UI 临时状态。
- 生产调试必须受审批和权限控制。
- 断点触发时必须生成 `BreakpointHit` 记录，包含 `harness_run_id`、`node_run_id`、`timestamp`、`triggered_by`。
- 时间旅行调试须基于 `NodeAttemptReceipt` 重放，不得直接重放 side effect。
- `HarnessRunSnapshot` 用于全量状态回溯；`WorkflowTraceFrame` 用于单点时序分析。

## v4.3 Contract Remediation

- T-69: 本文原先把 breakpoint 锚点绑定到 `workflow_id / step_selector`，根因是 debugger contract 建在旧 workflow 调试器原型之上，没有切换到 `HarnessRun / NodeRun` 调试语义。修复：正文现以 `harness_run_id / node_run_id / node_selector` 为权威锚点，新增 `HarnessRunSnapshot`、`NodeRunTrace`、`PlanGraphDiff` 完整模型，废弃旧 workflow 术语只允许出现在投影视图中。
- R2-61 修复：全文从 workflow/step 语义迁移到 HarnessRun/NodeRun/PlanGraph 语义；新增 `HarnessRunSnapshot` 用于全量状态回溯；新增 `PlanGraphDiff` 支持计划图比对。

## 9. 测试要求

- unit：breakpoint matching、trace frame normalization、graph diff
- integration：runtime trace -> debugger -> replay/compare
- contract：未授权用户不得设置生产断点；断点不得改变 authoritative 状态