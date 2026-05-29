# UI Console And Cockpit Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines Automatic Agent 的 Web Console、Task Cockpit、Workflow Cockpit、Approval Center、Stability Panel 和 Admin Takeover Console 的最小界面边界。

它回答的Issueis：

- UI 首先服务什么对象
- 首页先展示什么
- 任务、审批、稳定性和接管页面至少要具备什么能力
- 页面data truth source 如何分层，避免每页each拼事实源

相关文档：

- `admin_console_and_human_takeover_contract.md`
- `debug_inspect_health_backpressure_contract.md`
- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `hitl_experience_and_explainability_contract.md`
- `api_surface_contract.md`

## 2. UI 总体principle

前端不is聊天窗口集合，而is：

- 任务工作台
- 审批vs治理工作台
- 稳定性vs运维工作台
- manage员接管工作台

最小principle：

1. 人class优先via `task / approval / inspect / takeover` 进入系统，不应directly对任意 agent 自由下指令。
2. 首页必须先回答“系统isno健康、当前在做什么、卡在哪里”。
3. 关键页面必须能下钻到 evidence、timeline、inspect，而不is只显示 summary。
4. 高风险动作必须展示风险等级、策略来源、审批链和接管入口。
5. UI 展示Status不得反向defines HarnessRun、PlanGraph 或 NodeRun 的 authoritative 事实。

## 3. Console 信息Architecture

推荐最小信息Architecture：

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

规则：

- 当前阶段不要求一iterations性铺满所有页面。
- 但导航分组应从一开始按能力域组织，而不is页面墙式平铺。

## 4. 首页排序规则

Console 首页应按以下优先级组织：

1. 顶部先展示：
   - `system status`
   - `current focus`
   - `active alerts`
2. 第一屏展示：
   - 当前活跃 task / workflow
   - runtime / queue / approval isno健康
   - 当前 backlog 派发到了哪
3. 第二屏展示：
   - blocked reason
   - stale / recovery / retry 摘要
   - 近期高风险 decision / approval
4. 原始日志、长 trace、原始事件尾部只能作为下钻视图，不得占据首页主视觉。

## 5. 核心页面

### 5.1 `TaskCockpit`

最小字段：

- `task_projection_ref`
- `harness_run_id`
- `harness_run_status`
- `active_node_run_id`
- `blocked_reason?`
- `latest_attempt_receipt_ref?`
- `latest_decision?`
- `artifact_refs`

最小动作：

- 打开 inspect
- 查看 timeline
- 查看 artifacts
- 取消任务
- 进入人工接管

### 5.2 `RunCockpit`

最小字段：

- `plan_graph_id`
- `harness_run_id`
- `harness_run_status`
- `node_runs`
- `active_node_run_id?`
- `dependency_state`
- `approval_nodes`
- `evidence_refs`

最小动作：

- 查看 step output
- 查看 dependency / blocked state
- 打开 recovery history
- 查看 compensation / replay 证据

### 5.3 `ApprovalCenter`

最小字段：

- `approval_id`
- `harness_run_id`
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

- `retry_step`
- `skip_step`
- `override_step_output`
- `switch_worker`
- `manual_cancel`
- `mark_unrecoverable`

## 6. 页面data truth source 分层

### 6.1 `shared_snapshot`

适used for：

- 顶部系统Status条
- Dashboard 首页摘要
- 稳定性总览头部

最小内容：

- overall health
- queue depth
- active executions
- approval backlog
- alert summary

### 6.2 `shared_query`

适used for：

- Dashboard
- Stability
- Approval Center
- Admin Console 概览

规则：

- 跨域聚合页面应优先复用共享 query，而不is每页each拉散 API。

### 6.3 `page_local_api`

适used for：

- task inspect
- workflow inspect
- approval inspect
- worker details
- artifact details

规则：

- domain-specific drill-down 可以有独立 API。
- 但页面不得私自拼 authoritative Status，应优先uses inspect / resource API。

## 7. Task-Flow Cockpit Drill-Down

Task / Workflow cockpit 至少supported 5 级下钻：

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

## 8. UI vs gateway / streaming 的关系

- Web UI 流式展示应遵守 `gateway_streaming_contract.md`。
- 显示层若需要做 chunk commit、catch-up 或 backlog drain，应按队列压力和消息年龄自适应，而不is按上游来源hardcodes特殊逻辑。
- 显示层 catch-up 不得打乱消息顺序，也不应via单帧暴力 flush 破坏可读性。
- 非流式控制台视图可以读聚合Status，但不得替代 stream 事实。
- UI 侧Status命名必须和 `debug_inspect_health_backpressure_contract.md` vs `api_surface_contract.md` 保持一致。

## 9. 当前明确不做

当前不directly采用：

- 重型 Canvas / A2UI package rendering 平台
- 大规模业务域工作台铺设
- 业务页面墙
- 在前端directly维护 capability / policy 真相

原因：

- 当前阶段的核心目标is先把 Stable Core 跑稳。
- 过早references入重型 UI 包运lines时，会放大前后端边界复杂度。
- Automatic Agent 当前更需要 task、workflow、stability、takeover 四class工作台，而不is业务域页面扩张。

## 10. 收口Conclusion

Automatic Agent 的 UI 不应首先长成“另一个聊天应用”。

更合理的基线is：

- 一个能看健康Status的 Console
- 一个能下钻 evidence 的 Task / Workflow Cockpit
- 一个能handle审批vs解释的 Approval Center
- 一个能接管和止损的 Admin Console
