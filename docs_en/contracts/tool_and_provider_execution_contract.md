# Tool And Provider Execution Contract

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR Execute Hub 的工具执lines层，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract defines LLM provider call、工具执lines、结果封装、错误语义和budget守卫的最小统一接口。

## 2. 关键对象

- `ModelRequest`
- `ModelResponse`
- `ToolCallRequest`
- `ToolCallResult`
- `ExecutionError`
- `BudgetReservationDecision`

## 3. ModelRequest 最小字段

| 字段 | class型 | Description |
|---|-------|--------|
| `request_id` | `string` | request唯一 ID |
| `harness_run_id` | `string` | 所属 HarnessRun |
| `node_run_id` | `string` | 所属 NodeRun |
| `attempt_id` | `string` | 所属 NodeAttempt |
| `task_id` | `string?` | 兼容查询入口；非 truth 主键 |
| `agent_id` | `string` | 发起角色 |
| `stage_view_ref` | `string?` | 当前闭环阶段 view references用；不驱动执lines语义 |
| `domain_id` | `string?` | 当前 domain |
| `provider` | `string` | provider 标识 |
| `model` | `string` | 目标模型 |
| `messages` | `Message[]` | 输入消息 |
| `tools` | `string[]?` | 允许模型call的工具 |
| `kv_cache_hint` | `json?` | KV cache 分区提示 |
| `budget_limit_usd` | `number?` | 本iterationsrequestbudgetupper limit |
| `timeout_ms` | `number` | timeout |

## 4. ModelResponse 最小字段

- `request_id`
- `provider`
- `model`
- `finish_reason`
- `output_text?`
- `tool_calls?`
- `usage`
- `latency_ms`
- `raw_response_ref?`

规则：

- provider 原始response可以归档，但上层只消费统一模型。
- `usage` 至少contains input / output token 信息。
- 若responsecontains工具call，必须保留稳定 call id。
- 进入消息、事件、summary 前的工具输出净化规则由 `tool_output_sanitization_contract.md` defines。

## 5. ToolCallRequest 最小字段

- `call_id`
- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `task_id?`
- `agent_id`
- `stage_view_ref?`
- `domain_id?`
- `tool_name`
- `arguments`
- `timeout_ms`
- `allowed_path_roots?`
- `requires_approval`
- `egress_targets?`

## 6. ToolCallResult 最小字段

- `call_id`
- `tool_name`
- `status`
- `output`
- `success`
- `data?`
- `metadata?`
- `artifacts?`
- `feedback_signals?`
- `knowledge_ref?`
- `duration_ms`
- `error?`
- `follow_up_question?`

`status` 枚举：

- `succeeded`
- `failed`
- `timed_out`
- `blocked`
- `cancelled`

## 7. BudgetReservationDecision

至少contains：

- `reservation_id`
- `ledger_id`
- `decision` (`reserved | rejected | review_required`)
- `estimated_cost_usd`
- `reserved_amount_usd?`
- `remaining_budget_usd`
- `expires_at?`
- `settlement_required`
- `reason_code?`
- `budget_scope_id?`

规则：

- LLM call前必须先创建或复用 `BudgetReservation`，而不is只做布尔放lines判断。
- 高风险工具执lines前必须同时via过budgetvspermission检查。
- workflow step 真正执lines前，若存在结构化输入输出约束，应先via `workflow_io_compatibility_precheck_contract.md`。
- success执lines后必须产生 `BudgetSettlement` 或显式释放 reservation；failed或取消也必须有可审计Conclusion。

## 8. 错误语义

`ExecutionError` 至少contains：

- `code`
- `message`
- `retryable`
- `source`
- `details?`

`source` 枚举：

- `provider`
- `tool`
- `network`
- `security`
- `validation`
- `system`

## 9. lines为约束

- provider adapter 不得把供应商特有字段泄漏成上层主语义relies on。
- 工具返回大文件时，主体结果应改为 artifact references用。
- 若callrequest未显式给出 `timeout_ms`，executor 必须先解析工具 metadata 中的 `default_timeout_ms` 再执lines。
- failed重试必须同时based on工具 metadata 的恢复策略vs结果中的 `retryable` 判断，不能盲目固定iterations数。
- 若callrequest带有 `allowed_path_roots` 或 execution precheck 已解析出 `resolved_paths_json`，工具访问路径必须同时满足 sandbox vs path scope 两层约束。
- 若 execution 持有 `allowed_tools_json`，direct tool vs skill 在运lines时都必须校验 `tool_name` isno在白名单内；缺失 execution、JSON 非法或数组项存在空值/非字符串时都必须 fail-closed。
- 所有call都必须能关联回 `task_id`、`agent_id`、`trace_id`。
- 所有call都必须首先能关联回 `harness_run_id`、`node_run_id`、`attempt_id`；`task_id` 只作为兼容查询入口。
- 若不同工具需要暴露额外结构化细节，应优先放入稳定的 `data / metadata` 字段，而不is让上层按工具名猜顶层字段。
- `edit / patch / replace` class工具的目标定位规则由 `edit_replacement_chain_contract.md` defines。
- 上下文接近 token upper limit时的裁剪vs compaction 规则由 `context_compaction_and_overflow_contract.md` defines。
- `WebFetch`、`command_exec`、`mcp_call` 这class可能产生network外发的工具，必须在执lines前解析并record `egress_targets`，至少覆盖 URL、ssh、s3、registry、publish 目标。
- provider / tool 侧的 retry 不得each维护独立 limiter；`retry-after`、breaker、provider limiter、tenant limiter 和 task limiter 应组合到同一治理面。
- `question` class工具必须返回结构化选项、推荐项、timeout语义和 skipped 语义，不得退化成普通文本提问。
- `todo_write` class工具必须只修改会话级待办Status，不得越权修改任务主Status。
- domain tool bundle 若存在，tool 解析必须优先走当前 `domain_id` 允许的工具集合；plugin SPI 工具不得bypassing同等 sandbox / policy / path 约束。
- `kv_cache_hint` 只能提供固定前缀 / domain block / variable suffix 的构建Recommendation，不得directly覆盖budget或裁剪策略。
- 若存在 cheap-vs-strong model route，路由必须保守、可解释，并在相同输入vs相同configure下保持确定性；至少要record `routing_reason` 或等价 route trace。
- 同 provider 多凭证 failover 应走统一 credential pool / cooldown 语义，不得让各 adapter 私自维护“局部 exhausted Status”。
- 若存在 turn-scoped fallback，当前 turn 内允许via显式 fallback lease 复用临时降级结果，但下一 turn defaults to必须重新尝试主 profile；fallback lease 不得no期限粘成新的 sticky profile。
- 对 `429 / 402 / retry-after / reset_at` 这class provider 节流vs配额信号，应统一writes provider governance Status，而不is只在单iterationsrequest内临时消费。
- tool name 解析应优先走 exact / alias / normalized exact；只有唯一候选时才允许 fuzzy correction，并必须保留 correction trace。歧义候选和可疑字符串必须 fail-closed。
- tool argument 若enabled宽松矫正，也必须限定在 schema 明确可security收敛的class型边界内；未知字段、结构歧义和高风险参数不得静默自动修正。
- tool argument correction 若发生，必须把 correction trace 暴露到 `metadata` 或 warnings 等可审计结果面；`command_exec`、`edit_replace`、`question`、`todo_write` 这class高频工具不得把矫正隐藏在黑盒里。
- 对高风险工具参数的非法class型或结构歧义，executor 必须 fail-closed 返回稳定错误码，而不is让底层实现因class型异常崩溃。
- `ModelResponse` / `ToolCallResult` 若要回传user摘要或学习信号，必须via `NodeAttemptReceipt` 或其references用回链；不得把 provider/tool 原始结果directly视为 runtime truth。

## 10. 补充规则

- 流式 chunk 至少统一contains：`stream_id`、`sequence`、`event_type`、`payload`。
- provider fallback 观测至少record：原 provider、fallback provider、触发原因、切换time、Impact范围。
- tool sandbox 结果摘要至少record：exit status、sanitized summary、artifact refs、policy notes。
- 对user可见文本、工具输出和抓取内容，应先做 NFC normalize，再清理控制字符vs Unicode Tags block，避免隐写注入和展示层混淆。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-19: 本文原先把 `task_id / execution_id / agent_id` 写成 provider/tool call主键，并把budget守卫压缩成 `BudgetCheckResult.allowed` 布尔结果，Root cause: 旧执lines合同accesses along用了单iterationsrequest视角，没有把call归属绑定到 `HarnessRun / NodeRun / NodeAttempt` 和budget reservation/settlement 生命cycle。修复：正文现把 `harness_run_id / node_run_id / attempt_id` 设为 canonical call身份，并把budget对象收敛到 `BudgetReservationDecision`。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
