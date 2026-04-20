# Tool And Provider Execution Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR Execute Hub 的工具执行层，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 定义 LLM provider 调用、工具执行、结果封装、错误语义和预算守卫的最小统一接口。

## 2. 关键对象

- `ModelRequest`
- `ModelResponse`
- `ToolCallRequest`
- `ToolCallResult`
- `ExecutionError`
- `BudgetCheckResult`

## 3. ModelRequest 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `request_id` | `string` | 请求唯一 ID |
| `task_id` | `string` | 关联任务 |
| `agent_id` | `string` | 发起角色 |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | 当前闭环阶段 |
| `domain_id` | `string?` | 当前 domain |
| `provider` | `string` | provider 标识 |
| `model` | `string` | 目标模型 |
| `messages` | `Message[]` | 输入消息 |
| `tools` | `string[]?` | 允许模型调用的工具 |
| `kv_cache_hint` | `json?` | KV cache 分区提示 |
| `budget_limit_usd` | `number?` | 本次请求预算上限 |
| `timeout_ms` | `number` | 超时 |

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

- provider 原始响应可以归档，但上层只消费统一模型。
- `usage` 至少包含 input / output token 信息。
- 若响应包含工具调用，必须保留稳定 call id。
- 进入消息、事件、summary 前的工具输出净化规则由 `tool_output_sanitization_contract.md` 定义。

## 5. ToolCallRequest 最小字段

- `call_id`
- `task_id`
- `agent_id`
- `execution_id?`
- `stage?`
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

## 7. BudgetCheckResult

至少包含：

- `allowed`
- `estimated_cost_usd`
- `remaining_budget_usd`
- `reason?`

规则：

- LLM 调用前必须经过预算守卫。
- 高风险工具执行前必须同时经过预算与权限检查。
- workflow step 真正执行前，若存在结构化输入输出约束，应先通过 `workflow_io_compatibility_precheck_contract.md`。

## 8. 错误语义

`ExecutionError` 至少包含：

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

## 9. 行为约束

- provider adapter 不得把供应商特有字段泄漏成上层主语义依赖。
- 工具返回大文件时，主体结果应改为 artifact 引用。
- 若调用请求未显式给出 `timeout_ms`，executor 必须先解析工具 metadata 中的 `default_timeout_ms` 再执行。
- 失败重试必须同时基于工具 metadata 的恢复策略与结果中的 `retryable` 判断，不能盲目固定次数。
- 若调用请求带有 `allowed_path_roots` 或 execution precheck 已解析出 `resolved_paths_json`，工具访问路径必须同时满足 sandbox 与 path scope 两层约束。
- 若 execution 持有 `allowed_tools_json`，direct tool 与 skill 在运行时都必须校验 `tool_name` 是否在白名单内；缺失 execution、JSON 非法或数组项存在空值/非字符串时都必须 fail-closed。
- 所有调用都必须能关联回 `task_id`、`agent_id`、`trace_id`。
- 若不同工具需要暴露额外结构化细节，应优先放入稳定的 `data / metadata` 字段，而不是让上层按工具名猜顶层字段。
- `edit / patch / replace` 类工具的目标定位规则由 `edit_replacement_chain_contract.md` 定义。
- 上下文接近 token 上限时的裁剪与 compaction 规则由 `context_compaction_and_overflow_contract.md` 定义。
- `WebFetch`、`command_exec`、`mcp_call` 这类可能产生网络外发的工具，必须在执行前解析并记录 `egress_targets`，至少覆盖 URL、ssh、s3、registry、publish 目标。
- provider / tool 侧的 retry 不得各自维护独立 limiter；`retry-after`、breaker、provider limiter、tenant limiter 和 task limiter 应组合到同一治理面。
- `question` 类工具必须返回结构化选项、推荐项、超时语义和 skipped 语义，不得退化成普通文本提问。
- `todo_write` 类工具必须只修改会话级待办状态，不得越权修改任务主状态。
- domain tool bundle 若存在，tool 解析必须优先走当前 `domain_id` 允许的工具集合；plugin SPI 工具不得绕过同等 sandbox / policy / path 约束。
- `kv_cache_hint` 只能提供固定前缀 / domain block / variable suffix 的构建建议，不得直接覆盖预算或裁剪策略。
- 若存在 cheap-vs-strong model route，路由必须保守、可解释，并在相同输入与相同配置下保持确定性；至少要记录 `routing_reason` 或等价 route trace。
- 同 provider 多凭证 failover 应走统一 credential pool / cooldown 语义，不得让各 adapter 私自维护“局部 exhausted 状态”。
- 若存在 turn-scoped fallback，当前 turn 内允许通过显式 fallback lease 复用临时降级结果，但下一 turn 默认必须重新尝试主 profile；fallback lease 不得无期限粘成新的 sticky profile。
- 对 `429 / 402 / retry-after / reset_at` 这类 provider 节流与配额信号，应统一写入 provider governance 状态，而不是只在单次请求内临时消费。
- tool name 解析应优先走 exact / alias / normalized exact；只有唯一候选时才允许 fuzzy correction，并必须保留 correction trace。歧义候选和可疑字符串必须 fail-closed。
- tool argument 若启用宽松矫正，也必须限定在 schema 明确可安全收敛的类型边界内；未知字段、结构歧义和高风险参数不得静默自动修正。
- tool argument correction 若发生，必须把 correction trace 暴露到 `metadata` 或 warnings 等可审计结果面；`command_exec`、`edit_replace`、`question`、`todo_write` 这类高频工具不得把矫正隐藏在黑盒里。
- 对高风险工具参数的非法类型或结构歧义，executor 必须 fail-closed 返回稳定错误码，而不是让底层实现因类型异常崩溃。

## 10. 补充规则

- 流式 chunk 至少统一包含：`stream_id`、`sequence`、`event_type`、`payload`。
- provider fallback 观测至少记录：原 provider、fallback provider、触发原因、切换时间、影响范围。
- tool sandbox 结果摘要至少记录：exit status、sanitized summary、artifact refs、policy notes。
- 对用户可见文本、工具输出和抓取内容，应先做 NFC normalize，再清理控制字符与 Unicode Tags block，避免隐写注入和展示层混淆。
