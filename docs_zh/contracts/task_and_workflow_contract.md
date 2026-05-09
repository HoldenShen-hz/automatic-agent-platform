# Task And Workflow Contract

> **v4.3 兼容说明**：本文件保留为历史 task / workflow 语义说明。v4.3 新实现入口以 [task-intake-request-contract.md](./task-intake-request-contract.md)、[harness-run-contract.md](./harness-run-contract.md)、[plan-graph-patch-contract.md](./plan-graph-patch-contract.md) 和 [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md) 为准；`WorkflowStep` / `StepOutput` 只作为 legacy / projection 语义。

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR 主链任务与 workflow，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 定义任务、子任务、工作流状态、步骤输出、artifact 引用，以及 Phase 1a 需要稳定的运行时约束。

对 OAPEFLIR Phase 1-4 范围，本 contract 只定义 task/workflow 读模型如何投影闭环阶段、loop iteration 和反馈对象；真实执行边界由 `HarnessRun`、`PlanGraphBundle`、`NodeRun` 与 `NodeAttemptReceipt` 持有。

相关文档：
- [ADR-016 OAPEFLIR 八阶段模型](../adr/016-oapeflir-loop-model.md)

## 2. 关键对象

- `Task`
- `WorkflowState`
- `WorkflowStep`
- `StepOutput`
- `ArtifactRef`
- `TaskDependency`
- `ExecutableUnit`
- `ResultEnvelope`

## 3. Task authoritative 字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 任务唯一标识 |
| `parent_id` | `string?` | 父任务 ID，跨事业部拆分时使用 |
| `root_id` | `string` | 根任务 ID |
| `division_id` | `string?` | 目标事业部 |
| `title` | `string` | 任务标题 |
| `status` | `TaskStatus` | 任务状态 |
| `source` | `user \| observe \| system` | 任务来源 |
| `priority` | `low \| normal \| high \| urgent` | 优先级 |
| `input` | `json` | 原始输入 |
| `normalized_input` | `json?` | 规范化输入 |
| `output` | `json?` | 最终输出摘要 |
| `artifacts` | `ArtifactRef[]` | 产出物引用 |
| `estimated_cost_usd` | `number?` | 预估成本 |
| `actual_cost_usd` | `number` | 实际成本 |
| `error_code` | `string?` | 失败原因码 |
| `created_at` | `timestamp` | 创建时间 |
| `updated_at` | `timestamp` | 更新时间 |
| `completed_at` | `timestamp?` | 完成时间 |

`TaskStatus` 以 [runtime_state_machine_contract.md](./runtime_state_machine_contract.md) 为准。

## 4. Task 运行约束

- `root_id` 在整棵任务树内保持稳定。
- `parent_id` 为空表示根任务；非空时必须指向已存在任务。
- `division_id` 在 HQ 分诊前可为空，但进入 division 执行前必须确定。
- `actual_cost_usd` 初始为 `0`，仅允许累加更新。
- 进入终态时必须同步写入 `completed_at` 或失败终结时间。

## 5. WorkflowState 投影字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `task_id` | `string` | 关联任务 |
| `division_id` | `string` | 归属事业部 |
| `workflow_id` | `string` | workflow 定义标识 |
| `harness_run_id` | `string` | 对应 HarnessRun |
| `plan_graph_bundle_id` | `string?` | 当前执行图 bundle |
| `graph_version` | `number?` | 当前图版本 |
| `current_step_index` | `number` | 当前步骤索引投影 |
| `status` | `WorkflowStatus` | 工作流读模型状态 |
| `current_stage_view` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | 当前 OAPEFLIR 阶段视图 |
| `loop_iteration_view` | `number` | 当前闭环轮次视图，从 1 开始 |
| `outputs` | `Record<string, StepOutput>` | 步骤输出映射 |
| `feedback_signals` | `string[]?` | 关联 feedback signal ID 列表 |
| `learning_objects` | `string[]?` | 关联 learning object ID 列表 |
| `improvement_candidates` | `string[]?` | 关联 improvement candidate ID 列表 |
| `release_records` | `string[]?` | 关联 release record ID 列表 |
| `last_error_code` | `string?` | 最近错误码 |
| `retry_count` | `number` | 当前累计重试次数 |
| `started_at` | `timestamp` | 开始时间 |
| `updated_at` | `timestamp` | 更新时间 |
| `resumable_from_step` | `string?` | 可恢复步骤标识 |

规则：

- `WorkflowState` 是从 `HarnessRun`、`PlanGraphBundle`、`NodeRun` 与 `NodeAttemptReceipt` 派生的读模型，不是 runtime truth。
- `status`、`current_stage_view`、`loop_iteration_view` 若与 truth 冲突，必须重建投影，不得反向改写执行主链。

## 6. WorkflowStep authoritative 字段

每个步骤至少包含：

- `node_run_id`
- `harness_run_id`
- `role_id`
- `input_binding`
- `output_key`
- `toolset?`
- `parallel?`
- `max_attempts?`
- `timeout_ms?`
- `precondition_check?`
- `approval_policy?`

规则：

- `node_run_id` 是步骤的唯一主键，关联到 `NodeRun` truth。
- `input_binding` 必须可解析为上游输出、任务输入或系统上下文。
- `output_key` 在同一 workflow 内唯一。
- `approval_policy` 仅定义是否需要升级，不承载渠道交互细节。

## 6A. OAPEFLIR Workflow 附加对象

`PlanGraphBundle` 是 plan 阶段到 execute 阶段的唯一权威交接对象，最小字段：

- `planGraphBundleId`
- `harnessRunId`
- `graphVersion`
- `graph`
- `schedulerPolicy`
- `budget`
- `riskProfile`

`PlanDTO` 仅允许作为 legacy 调试视图或导入输入；执行前必须归一化为 `PlanGraphBundle`。

`FeedbackSignal` 在 workflow 中是一等对象，最小字段：

- `signal_id`
- `kind` (`satisfaction | correction | quality_metric | failure_signal`)
- `sentiment` (`positive | neutral | negative`)
- `source` (`user | system | runtime`)
- `evidence_ref?`
- `recorded_at`

规则：

- `current_stage_view` 和 `loop_iteration_view` 是 workflow 投影字段，不得替代 runtime truth。
- `FeedbackSignal` 可以由 execute 后置收集、用户纠正、解释链或审批回写产生，但必须回链到 workflow。
- `PlanGraphBundle` 是 plan 阶段到 execute 阶段的 authoritative 交接对象，不能用 `PlanDTO` 或临时 prompt 文本替代。

## 7. StepOutput authoritative 字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `node_run_id` | `string` | 关联 NodeRun ID |
| `harness_run_id` | `string` | 关联 HarnessRun ID |
| `attempt_id` | `string` | 关联 NodeAttempt ID |
| `role_id` | `string` | 执行角色 |
| `status` | `succeeded \| failed \| partial_success \| skipped` | 步骤结果 |
| `data` | `json` | 主输出数据 |
| `summary` | `string?` | 输出摘要 |
| `artifacts` | `ArtifactRef[]?` | 附件引用 |
| `token_cost` | `number` | token 成本 |
| `duration_ms` | `number` | 耗时 |
| `validation` | `json?` | schema 校验结果 |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | 产出所属阶段 |
| `produced_at` | `timestamp` | 产出时间 |

## 8. ArtifactRef authoritative 字段

- `artifact_id`
- `kind`
- `uri`
- `mime_type?`
- `size_bytes?`
- `checksum?`
- `created_at`

规则：

- 大文本、文件、图片和日志优先通过 artifact 引用表达。
- artifact 删除或迁移时，不得破坏已完成任务的可审计性。

## 9. TaskDependency

Phase 1a 允许最小依赖表达：

- `upstream_task_id`
- `downstream_task_id`
- `dependency_type`，取值 `hard \| soft`
- `created_at`

Phase 1a 中只要求能表达跨任务等待关系，不要求完整 DAG 查询能力。

## 10. 行为约束

- 工作流输入绑定应在运行时解析，不能靠字符串替换模拟。
- 输出写入状态前必须经过 schema 验证。
- `partial_success` 必须显式记录，不能伪装成成功。
- 任务终态与 workflow 终态必须在恢复逻辑中保持一致。
- workflow 的 `current_stage_view` 必须与 [runtime_state_machine_contract.md](./runtime_state_machine_contract.md) 的 OAPEFLIR stage lifecycle 投影一致。
- `feedback_signals / learning_objects / improvement_candidates / release_records` 至少要能在 inspect 与 audit 中被稳定追踪，不能只留在日志文本里。

## 11. 失败语义

- 步骤失败先走有限重试。
- 重试超限后交由工作流自愈、升级或任务失败处理。
- `cancelled` 与 `failed` 必须区分。
- 非法输入导致的失败应标记为不可重试。

### 11.1 步骤依赖级联失败

当 workflow 步骤存在依赖关系（通过 `input_binding` 引用上游 `output_key`）时，上游步骤失败或跳过会触发级联处理：

| 上游步骤状态 | 依赖类型 | 下游步骤处理 |
| --- | --- | --- |
| `failed` | `hard`（默认） | 下游步骤标记为 `skipped`，reason_code `upstream_dependency_failed` |
| `failed` | `soft` | 下游步骤仍可执行，缺失输入以 `null` 或默认值填充 |
| `skipped` | `hard` | 下游步骤级联 `skipped` |
| `skipped` | `soft` | 下游步骤仍可执行 |

规则：

- 级联 `skipped` 必须沿 DAG 传播，不得在中间步骤中断后让更下游步骤无限期停留在 `blocked`。
- 级联判定应在步骤调度前完成，不得等到步骤实际开始执行时才发现输入不可用。
- 所有被级联跳过的步骤必须记录 `StepOutput`（status=`skipped`），保证 workflow 输出映射完整。
- 若级联导致所有关键步骤被跳过，workflow 应进入 `failed`，不得进入 `completed`。
- 步骤依赖级联与 `workflow_static_analysis_and_compensation_contract.md` §6 的静态分析规则保持一致。

## 12. 补充规则

- 条件分支 DSL 至少支持：`equals`、`exists`、`not_exists`、`greater_than`、`all_of`、`any_of`。
- 子任务聚合输出至少包含：`summary`、`successful_children`、`failed_children`、`artifacts`、`warnings`。
- artifact 生命周期应绑定 task retention policy，GC 不得先于审计窗口执行。

补充说明：

- 统一执行单元抽象以下钻文档 `executable_unit_contract.md` 为准。
- 统一结果封装以下钻文档 `result_envelope_contract.md` 为准。
- 闭环阶段与状态转换以下钻文档 `runtime_state_machine_contract.md` 为准。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-22: 本文原先把 `PlanDTO` 和 `WorkflowState.current_stage` 写成执行主链的权威交接/权威状态，根因是早期 workflow contract 试图同时承载编排 truth 与 UI/认知视图，导致 plan handoff 和 stage view 混在一个对象里。修复：正文现把权威交接收敛到 `PlanGraphBundle`，并把 `WorkflowState.current_stage_view` 明确降为投影字段。
- T-18: 原 `WorkflowStep` / `StepOutput` 以 `step_id` 为语义主键（legacy workflow step 遗留），但 v4.3 执行 truth 以 `node_run_id` 为准。修复：§6 明确 `node_run_id` 是步骤唯一主键，关联到 `NodeRun` truth；§7 `StepOutput` 关联字段已收敛到 `node_run_id / harness_run_id / attempt_id`。旧 `step_id` 仅作为 legacy projection 追溯字段。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
