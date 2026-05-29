# Error Code Registry

> Companion note:
> 稳定错误码#空间以 `error_code_registry_contract.md` 为 contract authority。
> 本文保留为面向实现者和读者的注册table正文，不再vs其维护第二套 SOT。

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

本文件defines当前阶段允许uses的稳定 `AppError.code` 注册table。

规则：

- 新的对外 `AppError.code` 进入实现前，必须先登记到这里。
- 已进入实现的对外错误码不得随意改名。
- 启动巡检、内部断言、一iterations性迁移诊断允许保留局部 snake_case / colon 风格，但不得冒充对外稳定 API / SDK / runtime contract error code。

## 2. 命名规则

对外稳定错误码统一格式：

- `<category>.<reason>`

示例：

- `validation.invalid_input`
- `provider.rate_limited`
- `runtime.recovery_required`

## 3. 基线错误码

| code | category | retryable | Description |
|---|-------|--------| --- |
| `validation.invalid_input` | `validation` | `false` | 输入不合法或缺字段 |
| `validation.schema_mismatch` | `validation` | `false` | workflow 输入输出不兼容 |
| `policy.approval_required` | `policy` | `false` | 必须人工审批 |
| `policy.action_denied` | `policy` | `false` | 策略显式拒绝 |
| `auth.permission_denied` | `auth` | `false` | permission不足 |
| `mission.not_found` | `mission` | `false` | Mission don't exist |
| `mission.member_not_found` | `mission` | `false` | Mission 成员don't exist |
| `mission.if_match_required` | `mission` | `false` | Mission 写操作缺少 `If-Match` |
| `mission.version_conflict` | `mission` | `false` | Mission 版本conflicts |
| `budget.budget_exceeded` | `budget` | `false` | budgetexceeds限 |
| `budget.quota_exceeded` | `budget` | `false` | 配额exceeds限 |
| `api.not_found` | `api` | `false` | API 路由don't exist |
| `api.invalid_message` | `api` | `false` | WebSocket / channel message 不合法 |
| `api.unknown_message` | `api` | `false` | WebSocket / channel message class型未知 |
| `api.payload_too_large` | `api` | `false` | API request体过大 |
| `api.origin_forbidden` | `api` | `false` | API Origin 不在白名单 |
| `api.prompt_bundle_not_found` | `api` | `false` | Prompt bundle don't exist |
| `api.rate_limit_exceeded` | `api` | `true` | API 限流触发 |
| `api.server_shutting_down` | `api` | `true` | 服务正在关闭 |
| `api.duplicate_request` | `api` | `false` | API 检测到repeatsrequest体或 request id |
| `api.idempotency_key_required` | `api` | `false` | 缺少幂等键 |
| `api.idempotency_key_conflict` | `api` | `false` | 幂等键vs历史requestconflicts |
| `api.idempotency_request_in_flight` | `api` | `true` | 相同幂等键request仍在handle中 |
| `api.idempotency_cached_response_too_large` | `api` | `true` | 幂等cacheresponse过大，no法security回放 |
| `api.idempotency_cached_response_corrupt` | `api` | `true` | 幂等cache损坏 |
| `api.openapi_auth_required` | `api` | `false` | OpenAPI 文档访问需要鉴权 |
| `api.unsupported_media_type` | `api` | `false` | request媒体class型不supported |
| `provider.rate_limited` | `provider` | `true` | provider 429 或等价限流 |
| `provider.temporary_unavailable` | `provider` | `true` | provider 暂时不可用 |
| `provider.compaction_unavailable` | `provider` | `true` | compaction / summarize provider 临时不可用 |
| `tool.execution_failed` | `tool` | `false` | 工具执linesfailed且不可自动重试 |
| `tool.temporary_io_error` | `tool` | `true` | 工具遇到临时 IO Issue |
| `tool.edit_target_not_found` | `tool` | `false` | edit / patch 未找到目标 |
| `tool.edit_multiple_candidates` | `tool` | `false` | edit / patch 命中多个候选 |
| `tool.edit_similarity_too_low` | `tool` | `false` | edit / patch 模糊匹配相似度不足 |
| `tool.file_lock_conflict` | `tool` | `true` | 文件锁conflicts，可等待后重试 |
| `tool.file_lock_timeout` | `tool` | `true` | 文件锁等待timeout |
| `sandbox.path_denied` | `sandbox` | `false` | 访问路径exceeds出白名单 |
| `sandbox.network_denied` | `sandbox` | `false` | network访问被策略拒绝 |
| `sandbox.exec_denied` | `sandbox` | `false` | 进程执lines被沙箱或策略拒绝 |
| `sandbox.isolation_broken` | `sandbox` | `false` | 隔离约束no法保证 |
| `storage.write_failed` | `storage` | `true` | 写storagefailed |
| `workflow.dependency_unavailable` | `workflow` | `true` | 上游relies on暂不可用 |
| `runtime.recovery_required` | `runtime` | `true` | 需要恢复流程 |
| `runtime.stale_lock_detected` | `runtime` | `true` | 检测到过期锁或陈旧运lines |
| `runtime.context_overflow` | `runtime` | `true` | 上下文exceeds限需裁剪或压缩 |
| `contract.legacy_surface_used` | `contract` | `false` | 触达only为兼容保留的 legacy contract surface |
| `contract.deprecated_surface_used` | `contract` | `false` | 触达已弃用 contract surface，需迁移到 canonical surface |
| `tenant.not_found` | `tenant` | `false` | 找不到租户或工作区归属 |
| `tenant.boundary_violation` | `tenant` | `false` | 访问跨租户边界 |
| `tenant.workspace_mismatch` | `tenant` | `false` | workspace vs tenant / org 归属inconsistent |
| `external.service_unavailable` | `external` | `true` | 外部系统暂不可用 |
| `internal.unexpected_error` | `internal` | `false` | 未分class内部错误 |

## 4. 特殊映射规则

- provider 的 `429` 映射到 `provider.rate_limited`
- provider 的 `5xx` 映射到 `provider.temporary_unavailable`
- 文件锁获取conflicts映射到 `tool.file_lock_conflict`
- 文件锁等待timeout映射到 `tool.file_lock_timeout`
- 历史兼容告警 `AA_LEGACY_CONTRACT` 映射到 `contract.legacy_surface_used`
- 历史兼容告警 `AA_DEPRECATED_CONTRACT` 映射到 `contract.deprecated_surface_used`
- WebSocket / channel message 验证failed映射到 `api.invalid_message`

## 5. 补充规则

- provider、tool、enterprise 的扩展子码可以在实现落地后追加到注册table；未实现条目不得提前标记为 canonical。
