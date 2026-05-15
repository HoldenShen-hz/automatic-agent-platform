# Runtime Execution Contract

> **v4.3 兼容说明**：本文件保留为历史 runtime execution 语义说明。v4.3 新执行主链以 `HarnessRun`、`PlanGraphBundle`、`NodeRun`、`NodeAttempt` 与 `NodeAttemptReceipt` 为 canonical contract，详见 [harness-run-contract.md](./harness-run-contract.md)、[plan-graph-patch-contract.md](./plan-graph-patch-contract.md) 和 [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md)。

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR Execute Hub 的 runtime 执行层，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 定义 Phase 1a 运行时执行层的最小 authoritative 模型，包括执行包、precheck、资源守卫、重试、心跳、阻塞和 dead-letter 语义。

它回答的问题不是”任务状态是什么”，而是”一个 `HarnessRun` 下的 `NodeRun / NodeAttempt` 如何在 runtime 中被接住、检查、执行、恢复和终止”。

相关文档：

- `runtime_state_machine_contract.md` 负责状态机本身。
- `supervisor_contract.md` 负责监管和告警边界。
- `task_and_workflow_contract.md` 负责任务与 workflow 主链。
- [ADR-016 OAPEFLIR 八阶段模型](../adr/016-oapeflir-loop-model.md)

## 2. 关键对象

- `ExecutionEnvelope`
- `ExecutionPrecheckResult`
- `RuntimeGuardrail`
- `RetryPolicy`
- `DeadLetterRecord`
- `HeartbeatSignal`
- `ExecutionEvidencePacket`

## 3. ExecutionEnvelope 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `harness_run_id` | `string` | 所属 HarnessRun |
| `node_run_id` | `string` | 当前 NodeRun |
| `attempt_id` | `string` | 当前 NodeAttempt |
| `task_id` | `string?` | 兼容查询入口；非 truth 主键 |
| `workflow_id` | `string?` | legacy workflow 投影引用；不得作为 truth 主键 |
| `agent_id` | `string` | 执行主体 |
| `role_id` | `string?` | 承担角色 |
| `run_kind` | `node_execution \| tool_call \| hitl_resume \| replay \| evaluator \| compensation \| release_gate` | 执行类型 |
| `plan_graph_bundle_id` | `string` | 当前执行图 bundle |
| `graph_version` | `integer` | 当前图版本 |
| `stage_view_ref` | `string?` | 关联 OAPEFLIR 阶段 view；仅用于展示/解释 |
| `loop_iteration_view` | `integer?` | 闭环轮次投影；不驱动 runtime truth |
| `domain_id` | `string?` | 当前 domain 绑定 |
| `knowledge_namespace` | `string?` | 当前 knowledge namespace |
| `strategy_version` | `string?` | 当前策略版本 |
| `input_ref` | `string?` | 输入快照或 artifact 引用 |
| `trace_id` | `string` | 链路追踪 ID |
| `attempt_no` | `integer` | 第几次尝试，从 1 开始 |
| `timeout_ms` | `integer` | 最大运行时长 |
| `budget_usd_limit` | `number?` | 预算上限 |
| `requires_approval` | `boolean` | 是否需要审批后才能继续 |
| `created_at` | `timestamp` | 创建时间 |

约束：

- `attempt_id` 必须与一次明确的 `NodeAttempt` 一一对应。
- `harness_run_id`、`node_run_id`、`attempt_id` 的 lineage 不能被投影层替换或重写。
- `attempt_no` 只能递增，不能覆盖旧尝试。
- Ring 1 允许 envelope 存于 DB + 内存运行态组合中，但字段语义必须稳定。
- `stage_view_ref` 只能关联 view / rationale，不得作为状态机推进条件。

## 4. run_kind 枚举

- `node_execution`: 标准节点执行。
- `tool_call`: 工具调用或外部执行步骤。
- `hitl_resume`: 审批通过后恢复执行。
- `replay`: 重放、恢复或诊断性执行。
- `evaluator`: 对输出做评估、guardrail 检查或 acceptance 决策。
- `compensation`: 针对已确认副作用的补偿路径执行。
- `release_gate`: 受控 release / canary / rollback 相关运行。

Phase 1a 不引入更复杂的 `job_class` / `job_tier` 体系，避免过早平台化。

## 5. Precheck 契约

在 `created -> prechecking -> executing` 之间，runtime 至少要完成以下检查：

- 输入存在且可解析。
- 当前 `HarnessRun` / `NodeRun` 不处于终态。
- 预算、权限和 required approval 条件满足。
- 运行目录、sandbox 策略和工具白名单已解析。
- timeout、retry policy、trace_id 已绑定。
- `plan_graph_bundle_id` / `graph_version` 与 `node_run_id` 的绑定存在且未漂移。
- `attempt_id` 的 lineage、lease / fencing token 与恢复策略合法。
- 若声明 `knowledge_namespace`，其 namespace 必须存在且当前环境允许访问。
- 若声明 `domain_id` 或 `strategy_version`，必须能解析到已注册配置或候选版本。
- `evaluator` / `compensation` / `release_gate` 不得跳过前序 evidence 依赖。

`ExecutionPrecheckResult` 最小字段：

- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `allowed`
- `reason_code?`
- `resolved_budget_usd?`
- `resolved_timeout_ms`
- `resolved_sandbox_mode`
- `checked_at`

行为约束：

- precheck 失败时必须进入 `blocked` 或 `failed`，不能静默跳过检查直接执行。
- 任何 fallback 都不得绕过预算、审批和安全边界。
- 不得使用 `stage_view_ref` 或 `workflow_id` 代替 `NodeRun` truth 做合法性判断。

## 6. Runtime Guardrail

`RuntimeGuardrail` 至少包括：

- `timeout_ms`
- `max_retries`
- `retry_backoff` (`none \| fixed \| exponential`)
- `sandbox_mode`
- `allowed_tools`
- `allowed_paths?`
- `budget_usd_limit?`
- `max_output_bytes?`

Phase 1a 规则：

- 默认每个 run 都必须有 timeout。
- 默认每个 run 都必须有 `max_retries`，即使值为 `0`。
- 高风险动作若需要审批，不得在审批前执行副作用步骤。

## 7. Retry Policy

`RetryPolicy` 最小字段：

- `max_retries`
- `backoff_strategy`
- `initial_delay_ms?`
- `max_delay_ms?`
- `retryable_error_codes`
- `provider_retry_header_policy?`

Phase 1a 最小语义：

- `transient_provider_error`
- `rate_limited`
- `temporary_io_error`

可默认视为可重试；以下默认不可自动重试：

- `approval_required`
- `permission_denied`
- `invalid_input`
- `budget_exceeded`

补充规则：

- 若 provider 返回 `retry-after-ms`、`retry-after` 或等价 header，应优先尊重 provider 指示，而不是盲目按本地回退曲线重试。
- `retry-after` 若为 HTTP date，应转换为相对等待时间，并受 `max_delay_ms` 上限约束。
- provider 明确返回 `is_retryable = false`、认证失败、能力不支持或上下文溢出时，不得进入自动重试。
- 重试状态应能区分 `transient_retryable`、`provider_throttled`、`permanent_provider_error`，避免 UI 与恢复策略混淆。

## 8. Heartbeat 与运行存活

`HeartbeatSignal` 最小字段：

- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `agent_id`
- `status`
- `sampled_at`
- `progress_message?`
- `cpu_pct?`
- `memory_mb?`

Phase 1a 建议规则：

- 长运行步骤应定期发送 heartbeat。
- 心跳默认用于 liveness 和监控，不是 authoritative 业务事实源。
- 高频 heartbeat 不要求每条都写入持久层，可聚合后采样落库或仅保留最近快照。
- attempt 的最终 truth 必须通过 `NodeAttemptReceipt` 落库；heartbeat 不能替代回执。

## 9. 阻塞、审批与恢复

- 若 precheck 判断需要外部审批，run 应进入 `blocked`，任务进入 `awaiting_decision`。
- `hitl_resume` 类型的执行必须引用原始 `node_run_id` / `attempt_id` 或其 lineage。
- 恢复执行前必须重新做最小 precheck，不能直接从旧内存态继续跑。

## 10. Dead Letter 语义

`DeadLetterRecord` 最小字段：

- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `task_id`
- `final_reason_code`
- `retry_count`
- `last_error_message?`
- `moved_at`

Phase 1a 推荐原因码：

- `max_retries_exhausted`
- `timeout_exceeded`
- `budget_exceeded`
- `approval_not_resolved`
- `permission_denied`
- `unexpected_runtime_error`

规则：

- dead-letter 是运行失败分类，不自动等于任务整体永久失败。
- 进入 dead-letter 后，必须能追溯到最后一次 `attempt_id`、错误码和尝试次数。

## 11. Execution Evidence 与审计绑定

`ExecutionEvidencePacket` 最小字段：

- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `task_id`
- `attempt_no`
- `started_at`
- `completed_at?`
- `result_kind` (`success | partial | failed | cancelled | blocked`)
- `output_ref?`
- `artifact_refs`
- `policy_decision_ref?`
- `error_code?`
- `stage_view_ref?`
- `loop_iteration_view?`
- `feedback_signal_refs?`
- `learning_object_refs?`
- `strategy_version_ref?`
- `release_record_ref?`
- `recorded_at`

规则：

- 每次 execution 进入终态前，必须先沉淀一份最小 evidence packet。
- evidence packet 不替代日志，但它是后续 inspect、recovery 和 audit 的稳定抓手。
- `partial` 必须显式标记，不能和 `success` 混用。
- 若 execution 因策略或审批被阻断，也应能落下对应 evidence，避免“没执行也没证据”。
- `stage_view_ref` / `loop_iteration_view` 仅是 view 层引用，不得替代 `NodeAttemptReceipt` 的结果语义。
- `feedback` / `learn` / `improve` / `release` 相关投影结束时，必须至少写出一个闭环引用字段或显式写明 `no_artifact_generated` 原因。

## 12. 与状态机的关系

- 本 contract 定义 runtime run 的执行语义。
- `runtime_state_machine_contract.md` 定义 run 状态跃迁是否合法。
- 实现时不得在状态机之外私自创造另一套执行终态含义。

## 13. 失败语义

- runtime 崩溃恢复后，应至少能识别哪些 `NodeAttempt` 处于进行中且无 `NodeAttemptReceipt`。
- precheck 未完成的 run 不能被视为已实际执行。
- 重试与人工恢复必须保留 lineage，而不是覆盖旧记录。

## 14. 补充规则

- Phase 1b 开始引入 lease、handover 和 multi-worker 语义时，execution attempt 与 fencing token 必须保持单调递增。
- 资源隔离至少细分：token budget、wall-clock timeout、worker class、sandbox quota。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-15: 本文原先把 `ExecutionEnvelope.stage`、旧执行标识字段和 `workflow` 语义写成 runtime 主键，根因是旧版执行模型把 OAPEFLIR 阶段视作执行状态机的一部分，导致 view 字段混进了真实执行包。修复：正文现把执行主体收敛到 `harness_run_id / node_run_id / attempt_id / plan_graph_bundle_id / graph_version`，并把 `stage_view_ref` 降为只读解释引用。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
