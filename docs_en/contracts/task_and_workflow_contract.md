# Task And Workflow Contract

> **v4.3 兼容Description**：本文件保留为历史 task / workflow 语义Description。v4.3 新实现入口以 [task-intake-request-contract.md](./task-intake-request-contract.md)、[harness-run-contract.md](./harness-run-contract.md)、[plan-graph-patch-contract.md](./plan-graph-patch-contract.md) 和 [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md) 为准；`WorkflowStep` / `StepOutput` 只作为 legacy / projection 语义。

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR 主链任务vs workflow，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract defines任务、子任务、工作流Status、步骤输出、artifact references用，以及 Phase 1a 需要稳定的运lines时约束。

对 OAPEFLIR Phase 1-4 范围，本 contract 只defines task/workflow 读模型如何投影闭环阶段、loop iteration 和反馈对象；真实执lines边界由 `HarnessRun`、`PlanGraphBundle`、`NodeRun` vs `NodeAttemptReceipt` 持有。

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

| 字段 | class型 | Description |
|---|-------|--------|
| `id` | `string` | 任务唯一标识 |
| `parent_id` | `string?` | 父任务 ID，跨事业部拆分时uses |
| `root_id` | `string` | 根任务 ID |
| `division_id` | `string?` | 目标事业部 |
| `title` | `string` | 任务标题 |
| `status` | `TaskStatus` | 任务Status |
| `source` | `user \| observe \| system` | 任务来源 |
| `priority` | `low \| normal \| high \| urgent` | 优先级 |
| `input` | `json` | 原始输入 |
| `normalized_input` | `json?` | 规范化输入 |
| `output` | `json?` | 最终输出摘要 |
| `artifacts` | `ArtifactRef[]` | 产出物references用 |
| `estimated_cost_usd` | `number?` | 预估成本 |
| `actual_cost_usd` | `number` | 实际成本 |
| `error_code` | `string?` | failed原因码 |
| `created_at` | `timestamp` | 创建time |
| `updated_at` | `timestamp` | 更新time |
| `completed_at` | `timestamp?` | 完成time |

`TaskStatus` 以 [runtime_state_machine_contract.md](./runtime_state_machine_contract.md) 为准。

## 4. Task 运lines约束

- `root_id` 在整棵任务树内保持稳定。
- `parent_id` 为空table示根任务；非空时必须指向已存在任务。
- `division_id` 在 HQ 分诊前可为空，但进入 division 执lines前必须确定。
- `actual_cost_usd` 初始为 `0`，only允许累加更新。
- 进入终态时必须synchronouswrites `completed_at` 或failed终结time。

## 5. WorkflowState 投影字段

| 字段 | class型 | Description |
|---|-------|--------|
| `task_id` | `string` | 关联任务 |
| `division_id` | `string` | 归属事业部 |
| `workflow_id` | `string` | workflow defines标识 |
| `harness_run_id` | `string` | 对应 HarnessRun |
| `plan_graph_bundle_id` | `string?` | 当前执lines图 bundle |
| `graph_version` | `number?` | 当前图版本 |
| `current_step_index` | `number` | 当前步骤索references投影 |
| `status` | `WorkflowStatus` | 工作流读模型Status |
| `current_stage_view` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | 当前 OAPEFLIR 阶段视图 |
| `loop_iteration_view` | `number` | 当前闭环轮iterations视图，从 1 开始 |
| `outputs` | `Record<string, StepOutput>` | 步骤输出映射 |
| `feedback_signals` | `string[]?` | 关联 feedback signal ID 列table |
| `learning_objects` | `string[]?` | 关联 learning object ID 列table |
| `improvement_candidates` | `string[]?` | 关联 improvement candidate ID 列table |
| `release_records` | `string[]?` | 关联 release record ID 列table |
| `last_error_code` | `string?` | 最近错误码 |
| `retry_count` | `number` | 当前累计重试iterations数 |
| `started_at` | `timestamp` | 开始time |
| `updated_at` | `timestamp` | 更新time |
| `resumable_from_step` | `string?` | 可恢复步骤标识 |

规则：

- `WorkflowState` is从 `HarnessRun`、`PlanGraphBundle`、`NodeRun` vs `NodeAttemptReceipt` 派生的读模型，不is runtime truth。
- `status`、`current_stage_view`、`loop_iteration_view` 若vs truth conflicts，必须重建投影，不得反向改写执lines主链。

## 6. WorkflowStep authoritative 字段

每个步骤至少contains：

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

- `node_run_id` is步骤的唯一主键，关联到 `NodeRun` truth。
- `input_binding` 必须可解析为上游输出、任务输入或系统上下文。
- `output_key` 在同一 workflow 内唯一。
- `approval_policy` onlydefinesisno需要升级，不承载渠道交互细节。

## 6A. OAPEFLIR Workflow 附加对象

`PlanGraphBundle` is plan 阶段到 execute 阶段的唯一权威交接对象，最小字段：

- `planGraphBundleId`
- `harnessRunId`
- `graphVersion`
- `graph`
- `schedulerPolicy`
- `budget`
- `riskProfile`

`PlanDTO` only允许作为 legacy 调试视图或import输入；执lines前必须归一化为 `PlanGraphBundle`。

`FeedbackSignal` 在 workflow 中is一等对象，最小字段：

- `signal_id`
- `kind` (`satisfaction | correction | quality_metric | failure_signal`)
- `sentiment` (`positive | neutral | negative`)
- `source` (`user | system | runtime`)
- `evidence_ref?`
- `recorded_at`

规则：

- `current_stage_view` 和 `loop_iteration_view` is workflow 投影字段，不得替代 runtime truth。
- `FeedbackSignal` 可以由 execute 后置收集、user纠正、解释链或审批回写产生，但必须回链到 workflow。
- `PlanGraphBundle` is plan 阶段到 execute 阶段的 authoritative 交接对象，不能用 `PlanDTO` 或临时 prompt 文本替代。

## 7. StepOutput authoritative 字段

| 字段 | class型 | Description |
|---|-------|--------|
| `node_run_id` | `string` | 关联 NodeRun ID |
| `harness_run_id` | `string` | 关联 HarnessRun ID |
| `attempt_id` | `string` | 关联 NodeAttempt ID |
| `role_id` | `string` | 执lines角色 |
| `status` | `succeeded \| failed \| partial_success \| skipped` | 步骤结果 |
| `data` | `json` | 主输出data |
| `summary` | `string?` | 输出摘要 |
| `artifacts` | `ArtifactRef[]?` | 附件references用 |
| `token_cost` | `number` | token 成本 |
| `duration_ms` | `number` | 耗时 |
| `validation` | `json?` | schema 校验结果 |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | 产出所属阶段 |
| `produced_at` | `timestamp` | 产出time |

## 8. ArtifactRef authoritative 字段

- `artifact_id`
- `kind`
- `uri`
- `mime_type?`
- `size_bytes?`
- `checksum?`
- `created_at`

规则：

- 大文本、文件、图片和日志优先via artifact references用table达。
- artifact 删除或迁移时，不得破坏completed任务的可审计性。

## 9. TaskDependency

Phase 1a 允许最小relies ontable达：

- `upstream_task_id`
- `downstream_task_id`
- `dependency_type`，取值 `hard \| soft`
- `created_at`

Phase 1a 中只要求能table达跨任务等待关系，不要求完整 DAG 查询能力。

## 10. lines为约束

- 工作流输入绑定应在运lines时解析，不能靠字符串替换模拟。
- 输出writesStatus前必须via过 schema 验证。
- `partial_success` 必须显式record，不能assuccess。
- 任务终态vs workflow 终态必须在恢复逻辑中保持一致。
- workflow 的 `current_stage_view` 必须vs [runtime_state_machine_contract.md](./runtime_state_machine_contract.md) 的 OAPEFLIR stage lifecycle 投影一致。
- `feedback_signals / learning_objects / improvement_candidates / release_records` 至少要能在 inspect vs audit 中被稳定追踪，不能只留在日志文本里。

## 11. failed语义

- 步骤failed先走有限重试。
- 重试exceeds限后交由工作流自愈、升级或任务failedhandle。
- `cancelled` vs `failed` 必须区分。
- 非法输入导致的failed应标记为不可重试。

### 11.1 步骤relies on级联failed

当 workflow 步骤存在relies on关系（via `input_binding` references用上游 `output_key`）时，上游步骤failed或跳过会触发级联handle：

| 上游步骤Status | relies onclass型 | 下游步骤handle |
|---|-------|--------|
| `failed` | `hard`（defaults to） | 下游步骤标记为 `skipped`，reason_code `upstream_dependency_failed` |
| `failed` | `soft` | 下游步骤仍可执lines，缺失输入以 `null` 或defaults to值填充 |
| `skipped` | `hard` | 下游步骤级联 `skipped` |
| `skipped` | `soft` | 下游步骤仍可执lines |

规则：

- 级联 `skipped` 必须accesses along DAG 传播，不得在中间步骤中断后让更下游步骤no限期停留在 `blocked`。
- 级联判定应在步骤调度前完成，不得等到步骤实际开始执lines时才发现输入不可用。
- 所有被级联跳过的步骤必须record `StepOutput`（status=`skipped`），保证 workflow 输出映射完整。
- 若级联导致所有关键步骤被跳过，workflow 应进入 `failed`，不得进入 `completed`。
- 步骤relies on级联vs `workflow_static_analysis_and_compensation_contract.md` §6 的静态分析规则保持一致。

## 12. 补充规则

- 条件分支 DSL 至少supported：`equals`、`exists`、`not_exists`、`greater_than`、`all_of`、`any_of`。
- 子任务聚合输出至少contains：`summary`、`successful_children`、`failed_children`、`artifacts`、`warnings`。
- artifact 生命cycle应绑定 task retention policy，GC 不得先于审计窗口执lines。

补充Description：

- 统一执lines单元抽象以下钻文档 `executable_unit_contract.md` 为准。
- 统一结果封装以下钻文档 `result_envelope_contract.md` 为准。
- 闭环阶段vsStatus转换以下钻文档 `runtime_state_machine_contract.md` 为准。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-22: 本文原先把 `PlanDTO` 和 `WorkflowState.current_stage` 写成执lines主链的权威交接/权威Status，Root cause: 早期 workflow contract 试图同时承载编排 truth vs UI/认知视图，导致 plan handoff 和 stage view 混在一个对象里。修复：正文现把权威交接收敛到 `PlanGraphBundle`，并把 `WorkflowState.current_stage_view` 明确降为投影字段。
- T-18: 原 `WorkflowStep` / `StepOutput` 以 `step_id` 为语义主键（legacy workflow step 遗留），但 v4.3 执lines truth 以 `node_run_id` 为准。修复：§6 明确 `node_run_id` is步骤唯一主键，关联到 `NodeRun` truth；§7 `StepOutput` 关联字段已收敛到 `node_run_id / harness_run_id / attempt_id`。旧 `step_id` only作为 legacy projection 追溯字段。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
