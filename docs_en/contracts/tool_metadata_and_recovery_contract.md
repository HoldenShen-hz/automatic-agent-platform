# Tool Metadata And Recovery Contract

## 1. 范围

本 contract 把工具级幂等性、恢复策略和执lines边界下钻到“每个工具必须声明哪些元data”。

相关文档：

- `tool_skill_plugin_contract.md`
- `tool_and_provider_execution_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `file_lock_contract.md`
- `policy_engine_contract.md`

## 2. 目标

这份 contract 回答 3 个Issue：

- 每个工具最少要声明哪些恢复vssecurity元data。
- runtime、policy、FileLock、recovery 如何消费这些元data。
- 哪些工具差异必须在注册时讲清楚，不能留到运lines时猜。

## 3. 核心principle

- 幂等性不is运lines时推测，而is工具defines的一部分。
- 工具元data必须能支撑重试、恢复、审批、输出handle和路径保护。
- 任何缺少关键元data的工具，不应进入正式注册table。

## 4. `ToolExecutionMetadata`

| 字段 | class型 | Description |
|---|-------|--------|
| `tool_name` | `string` | 工具名 |
| `read_only` | `boolean` | isno只读 |
| `idempotent` | `boolean` | isnodefaults to可repeats执lines |
| `side_effect_scope` | `none \| local_file \| local_process \| remote_api \| billing \| org_state` | 副作用范围 |
| `recovery_strategy` | `retry_safe \| retry_with_check \| skip_if_verified \| manual_resume_required` | 恢复策略 |
| `requires_confirmation` | `boolean` | isnodefaults to需确认 |
| `risk_level` | `low \| medium \| high \| critical` | 风险等级 |
| `needs_file_lock` | `none \| read \| write \| dynamic` | 文件锁需求 |
| `path_scope_mode` | `none \| declared \| dynamic` | 路径范围声明模式 |
| `produces_artifact` | `boolean` | isno产出 artifact |
| `output_kind` | `text \| structured_json \| artifact_ref \| mixed` | 输出主形态 |
| `supports_streaming_output` | `boolean` | isno流式输出 |
| `provider_dependency` | `none \| optional \| required` | isnorelies on provider |
| `default_timeout_ms` | `number` | defaults totimeout |
| `max_output_bytes` | `number?` | 输出Recommendationupper limit |
| `retryable_error_codes_json` | `json?` | 允许 executor 自动重试的错误码集合 |
| `approval_mode` | `never \| policy_driven \| always` | 审批模式 |
| `supports_cancellation` | `boolean` | isnosupported显式取消 |
| `cleanup_guarantee` | `none \| best_effort \| required` | 取消或failed后的清理保证 |
| `requires_execution_receipt` | `boolean` | isno必须record receipt 才算副作用完成 |
| `high_risk_patterns_json` | `json?` | 命令级高风险模式清单 |
| `model_overrides_json` | `json?` | 按模型 profile / tier / capability 把逻辑工具切换到兼容或更保守的工具变体 |
| `domain_id` | `string?` | 该工具所属 domain |
| `plugin_source` | `builtin \| plugin_spi \| mcp \| gateway \| division \| external` | 工具来源 |
| `produces_feedback_signal` | `boolean` | isno可能产出 feedback signal |
| `knowledge_scope` | `none \| local \| namespace \| global` | 关联 knowledge 作用域 |
| `memory_scope` | `none \| local \| promotable` | 关联 memory 作用域 |

## 5. 最小声明要求

Phase 1a 每个工具至少必须声明：

- `read_only`
- `idempotent`
- `side_effect_scope`
- `recovery_strategy`
- `risk_level`
- `needs_file_lock`
- `output_kind`
- `approval_mode`
- `supports_cancellation`
- `cleanup_guarantee`

若工具缺失这些字段：

- 不应注册为 production-ready 工具
- 最多只能occurrences于实验或disabledStatus

## 6. 元data消费方

### 6.1 Runtime / Recovery

- uses `idempotent + recovery_strategy` 决定isno自动重试
- uses `default_timeout_ms` 和 `provider_dependency` 决定运lines guardrail
- uses `retryable_error_codes_json` 决定哪些failed可在 executor 层自动进入下一iterations attempt
- uses `supports_cancellation + cleanup_guarantee` 决定取消传播和failed收尾要求
- uses `requires_execution_receipt` 决定何时可以把副作用判定为“completed”

### 6.2 Policy Engine

- uses `risk_level + approval_mode + side_effect_scope` 决定 deny / allow / escalate

### 6.3 FileLock

- uses `needs_file_lock + path_scope_mode` 决定锁模式和路径分析要求

### 6.4 Output Sanitization

- uses `output_kind + max_output_bytes + produces_artifact` 决定裁剪和 artifact 分流

### 6.5 Model-Aware Tool Selection

- uses `model_overrides_json` 在执lines前把逻辑工具解析为vs当前模型 profile 兼容的具体工具。
- override 目标必须仍belongs to该 skill 的声明工具集vs运lines时 allowed tools 集合，不能借 profile 切换隐式扩权。
- 未知 model profile defaults to fail-closed，不应静默回退到未声明工具。

### 6.6 OAPEFLIR Hub Routing

- `produces_feedback_signal=true` 的工具，其结果必须允许路由到 FeedbackHub。
- `knowledge_scope != none` 的工具，其输出进入知识链前必须via过 provenance / sanitization 标注。
- `memory_scope=promotable` 只table示可进入后续 learn / memory promotion 候选，不等于自动晋升。
- `plugin_source=plugin_spi` 的工具必须同时受 plugin 注册Statusvs execution permission边界约束。

## 7. 典型工具族defaults to值

| 工具族 | `read_only` | `idempotent` | `recovery_strategy` | `needs_file_lock` |
|---|-------|--------| --- | --- |
| `read_file / grep / list` | is | is | `retry_safe` | `read` 或 `none` |
| `write_file` | no | 视覆盖策略 | `retry_with_check` | `write` |
| `edit / patch` | no | 视目标定位结果 | `retry_with_check` | `write` |
| `append_file` | no | no | `manual_resume_required` | `write` |
| `bash_readonly` | 视命令而定 | 低 | `retry_with_check` | `dynamic` |
| `remote_api_read` | is | 通常is | `retry_with_check` | `none` |
| `remote_api_write` | no | no | `manual_resume_required` | `none` |
| `llm_call` | is | is | `retry_safe` | `none` |

补充规则：

- `write_file / edit / append_file / remote_api_write` defaults to应设置 `supports_cancellation=true`，且至少为 `cleanup_guarantee=best_effort`。
- shell class工具应在 `high_risk_patterns_json` 中显式列出管道、重定向、命令替换、内联脚本等高风险模式。
- `remote_api_write` vs其他不可逆副作用工具Recommendation `requires_execution_receipt=true`。

## 8. 注册vs版本化规则

- 元data变化若Impact恢复、security或审批语义，必须视为版本化变化。
- 工具升级时不得静默改变 `idempotent` 或 `side_effect_scope`。
- 高风险变化应synchronous更新 contract 和测试 fixture。

## 9. 错误语义

Recommendation配套错误码：

- `validation.tool_metadata_missing`
- `validation.tool_metadata_invalid`
- `tool.recovery_strategy_unknown`
- `tool.retryable_error_code_unknown`

规则：

- 缺关键元databelongs to注册错误，不应拖到执lines阶段才发现。
- 元datavs实际lines为inconsistent时，应record为高优先级Architecture偏差。

## 10. Phase 边界

Phase 1a 做：

- 工具最小恢复元data
- runtime / policy / file lock 对这些字段的消费边界

Phase 1b 做：

- 更细的工具族模板
- dynamically路径作用域vs复杂输出分流

当前不做：

- 自动从实现code反推完整元data
- Marketplace 级跨版本兼容求解

## 11. 收口Conclusion

工具系统isno可恢复，最终不取决于“工具够不够多”，而取决于每个工具isno把自己的副作用、幂等性和恢复策略讲清楚。
