# UI Console And Cockpit Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 release
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义 Automatic Agent 的 Web Console、Task Cockpit、Workflow Cockpit、Approval Center、Stability Panel 和 Admin Takeover Console 的最小界面边界。

它回答的问题是：

- UI 首先服务什么对象
- 首页先展示什么
- 任务、审批、稳定性和接管页面至少要具备什么能力
- 页面数据 truth source 如何分层，避免每页各自拼事实源

相关文档：

- `admin_console_and_human_takeover_contract.md`
- `debug_inspect_health_backpressure_contract.md`
- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `hitl_experience_and_explainability_contract.md`
- `api_surface_contract.md`

## 2. UI 总体原则

前端不是聊天窗口集合，而是：

- 任务工作台
- 审批与治理工作台
- 稳定性与运维工作台
- 管理员接管工作台

最小原则：

1. 人类优先通过 `task / approval / inspect / takeover` 进入系统，不应直接对任意 agent 自由下指令。
2. 首页必须先回答“系统是否健康、当前在做什么、卡在哪里”。
3. 关键页面必须能下钻到 evidence、timeline、inspect，而不是只显示 summary。
4. 高风险动作必须展示风险等级、策略来源、审批链和接管入口。
5. UI 展示状态不得反向定义 task、workflow 或 execution 的 authoritative 事实。

## 3. Console 信息架构

推荐最小信息架构：

- `Mission Control`
  - `Dashboard`
  - `Task Cockpit`
  - `Workflow Cockpit`
  - `Approval Center`
  - `Stability`
  - `Alerts`
- `Operations`
  - `Dispatch`
  - `Inspect`
  - `Health`
  - `Incidents`
- `Governance`
  - `Policy`
  - `Audit`
  - `Security`
  - `Runtime Decisions`
- `Admin`
  - `Takeover`
  - `Workers`
  - `Queues`
  - `Feature Flags`
  - `Capability / Entitlement`
- `Extended`（按需启用）
  - `Plugin Management`
  - `Domain Registry`
  - `SLA Configuration`
  - `Connector Catalog`
  - `Agent Lifecycle`
  - `Learning Hub`
- `Shared Features`
  - `Prompt Library`
  - `Template Builder`
  - `Evaluation Harness`
  - `Workflow Debugger`
  - `Cost Dashboard`
  - `Edge Runtime`
  - `Multi-Region`
  - `Compliance Reporter`
  - `Chaos Engineering`
  - `Capacity Planner`
  - `Workflow Debugger`
  - `Platform Ops Agent`

规则：

- 当前阶段不要求一次性铺满所有页面。
- 但导航分组应从一开始按能力域组织，而不是页面墙式平铺。
- Extended 和 Shared Features 为按需启用的扩展模块，根据部署规模逐步启用。

## 4. 首页排序规则

Console 首页应按以下优先级组织：

1. 顶部先展示：
   - `system status`
   - `current focus`
   - `active alerts`
2. 第一屏展示：
   - 当前活跃 task / workflow
   - runtime / queue / approval 是否健康
   - 当前 backlog 派发到了哪
3. 第二屏展示：
   - blocked reason
   - stale / recovery / retry 摘要
   - 近期高风险 decision / approval
4. 原始日志、长 trace、原始事件尾部只能作为下钻视图，不得占据首页主视觉。

## 5. 核心页面

### 5.1 `TaskCockpit`

最小字段：

- `harness_run_id`
- `NodeRun` 列表（含 node_id/status/input/output）
- `blocked_reason?`
- `latest_tool_call?`
- `latest_decision?`
- `artifact_refs`

最小动作：

- 打开 inspect
- 查看 timeline
- 查看 artifacts
- 取消任务
- 进入人工接管

### 5.2 `WorkflowCockpit`

最小字段：

- `harness_run_id`
- `plan_graph`（含 nodes/edges 图结构）
- `NodeRun` 列表（含 node_id/status/attempts）
- `dependency_state`
- `approval_nodes`
- `evidence_refs`

最小动作：

- 查看 node output
- 查看 dependency / blocked state
- 打开 recovery history
- 查看 compensation / replay 证据

### 5.3 `ApprovalCenter`

最小字段：

- `approval_id`
- `task_id`
- `risk_level`
- `reason_summary`
- `options`
- `recommended_option?`
- `deadline?`
- `policy_source`

最小动作：

- approve
- reject
- request_more_context
- open_explanation

### 5.4 `StabilityPanel`

最小字段：

- `active_tasks`
- `queued_tasks`
- `stale_executions`
- `recovered_executions`
- `failed_recoveries`
- `approval_backlog`
- `event_backlog`
- `worker_health`

最小动作：

- drill into stuck task
- inspect backlog
- open recovery evidence
- trigger incident workflow

### 5.5 `AdminTakeoverConsole`

最小字段：

- `task scope`
- `tenant / workspace scope`
- `execution owner`
- `lease / worker state`
- `recent events`
- `current model / prompt / policy version`
- `current capability / entitlement limit`

最小动作：

- 重试某个 `NodeAttempt`
- 跳过某个 `NodeRun`
- 注入 `override_artifact_ref`
- 变更 `worker / model / policy` 路由
- 触发 compensation / replay / rollback

约束：

- 不得再定义 `retry_step / skip_step / override_step_output` 这类 step-oriented legacy 动作名。
- 所有 takeover 动作必须显式携带 `harness_run_id`，节点级动作还必须带 `node_run_id`。
- workflow 图展示必须来自 `plan_graph`，不得以 `workflow_id + steps[] + current_step_index` 充当 cockpit truth。
- `retry_node_run`
- `skip_node_run`
- `override_node_output`
- `switch_worker`
- `manual_cancel`
- `mark_unrecoverable`

## 6. 页面数据 truth source 分层

### 6.1 `shared_snapshot`

适用于：

- 顶部系统状态条
- Dashboard 首页摘要
- 稳定性总览头部

最小内容：

- overall health
- queue depth
- active executions
- approval backlog
- alert summary

### 6.2 `shared_query`

适用于：

- Dashboard
- Stability
- Approval Center
- Admin Console 概览

规则：

- 跨域聚合页面应优先复用共享 query，而不是每页各自拉散 API。

### 6.3 `page_local_api`

适用于：

- task inspect
- workflow inspect
- approval inspect
- worker details
- artifact details

规则：

- domain-specific drill-down 可以有独立 API。
- 但页面不得私自拼 authoritative 状态，应优先使用 inspect / resource API。

## 7. Task-Flow Cockpit Drill-Down

Task / Workflow cockpit 至少支持 5 级下钻：

| 级别 | 展示内容 |
| --- | --- |
| `L1` | task list + status |
| `L2` | task details + workflow state |
| `L3` | step outputs + tool calls |
| `L4` | approval / decision / evidence chain |
| `L5` | trace / replay / recovery timeline |

规则：

- `completed` 不得只显示 summary，必须能进入 evidence。
- `blocked` 不得只显示“等待中”，必须显示 blocked reason 和 source。
- `failed` 不得只显示错误文本，必须能进入 error code、last step 和 recovery history。

## 8. UI 与 gateway / streaming 的关系

- Web UI 流式展示应遵守 `gateway_streaming_contract.md`。
- 显示层若需要做 chunk commit、catch-up 或 backlog drain，应按队列压力和消息年龄自适应，而不是按上游来源硬编码特殊逻辑。
- 显示层 catch-up 不得打乱消息顺序，也不应通过单帧暴力 flush 破坏可读性。
- 非流式控制台视图可以读聚合状态，但不得替代 stream 事实。
- UI 侧状态命名必须和 `debug_inspect_health_backpressure_contract.md` 与 `api_surface_contract.md` 保持一致。

## 9. 当前明确不做

当前不直接采用：

- 重型 Canvas / A2UI package rendering 平台
- 大规模业务域工作台铺设
- 业务页面墙
- 在前端直接维护 capability / policy 真相

原因：

- 当前阶段的核心目标是先把 Stable Core 跑稳。
- 过早引入重型 UI 包运行时，会放大前后端边界复杂度。
- Automatic Agent 当前更需要 task、workflow、stability、takeover 四类工作台，而不是业务域页面扩张。

## 10. 收口结论

Automatic Agent 的 UI 不应首先长成“另一个聊天应用”。

更合理的基线是：

- 一个能看健康状态的 Console
- 一个能下钻 evidence 的 Task / Workflow Cockpit
- 一个能处理审批与解释的 Approval Center
- 一个能接管和止损的 Admin Console

## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- R16-86: 本 contract 原先未明确标注 UI 视角的 canonical entity 锚点和 legacy 映射关系，根因是 UI contract 在 v4.3 迁移期间未同步 re-baseline，仍引用旧架构的 task/execution 视图。修复：正文现明确 UI 层必须以 `HarnessRun` / `NodeRun` / `PlanGraphBundle` 为 authoritative entity，`task_id` 只作为 legacy projection 查询键，`execution` / `WorkflowState` / `TaskRecord` 仅保留兼容 alias。

强制规则：UI 展示层不得反向定义 runtime truth；`TaskCockpit` / `WorkflowCockpit` 必须锚定 `harness_run_id` + `node_runs[]` 主链；`plan_graph` 展示必须使用 `PlanGraphBundle` 而非旧 `ExecutionPlan` / `WorkflowStep` 线性结构；`ApprovalCenter` 的 `task_id` 投影必须显式映射到 `harness_run_id`；所有 legacy 别名字段不得作为新实现入口。

### Canonical Entity Mapping for UI Contracts

| UI 旧称 | v4.3 Canonical | 备注 |
| --- | --- | --- |
| `task_id`（作为主键） | `harness_run_id` | UI Cockpit 锚点必须用 `harness_run_id`，`task_id` 仅作 legacy 查询兼容 |
| `execution_id` | `harness_run_id` | `/executions/:id/inspect` 只保留兼容别名，映射到 harness_run |
| `step_id` | `node_run_id` | Cockpit 展示 node 状态必须用 `NodeRun`，`step_id` 仅作 legacy alias |
| `WorkflowState` | `HarnessRun` + `PlanGraphBundle` 投影 | WorkflowCockpit 状态源必须是 `HarnessRun.status` + `planGraphBundle.graph` |
| `TaskRecord` | `HarnessRun` + `TaskInspectView` | TaskCockpit 顶层必须展示 `HarnessRun`，不得直接展示旧 TaskRecord |
| `ExecutionPlan` | `PlanGraphBundle` | Plan graph 展示必须用 `PlanGraphBundle`，`ExecutionPlan` 仅作兼容 alias |

### UI Contract 引用约束

- UI contract 必须引用 v4.3 canonical contract（`harness-run-contract.md`、`plan-graph-patch-contract.md`、`node-run-attempt-receipt-contract.md`），不得引用旧 v3.x runtime 文档作为 authoritative 源。
- OAPEFLIR 阶段视图（`current_stage_view` / `loop_iteration_view`）是投影字段，不得作为 runtime truth 使用。
- UI 侧的 `blocked_reason` 展示必须可 drill-down 到 `NodeRun.status` + `HarnessRun` 状态机，而非只展示字符串。
- `ApprovalCenter` 的 `task_id` 展示必须能映射到对应的 `harness_run_id`，供 operator 追溯完整执行链。
