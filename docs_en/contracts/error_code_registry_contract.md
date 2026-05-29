# Error Code Registry

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

本文件defines当前阶段允许uses的稳定错误码注册table。

规则：

- 新错误码进入实现前，必须先登记到这里。
- 错误码一旦进入实现，不得随意改名。

## 2. 命名规则

统一格式：

- `<category>.<reason>`

示例：

- `validation.invalid_input`
- `provider.rate_limited`

## 3. 基线错误码

| code | category | retryable | Description |
|---|-------|--------| --- |
| `validation.invalid_input` | `validation` | `false` | 输入不合法或缺字段 |
| `validation.schema_mismatch` | `validation` | `false` | workflow 输入输出不兼容 |
| `policy.approval_required` | `policy` | `false` | 必须人工审批 |
| `policy.action_denied` | `policy` | `false` | 策略显式拒绝 |
| `auth.permission_denied` | `auth` | `false` | permission不足 |
| `budget.budget_exceeded` | `budget` | `false` | budgetexceeds限 |
| `budget.quota_exceeded` | `budget` | `false` | 配额exceeds限 |
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

## 5. 补充规则

- provider 子码至少细分：`provider.context_window_exceeded`、`provider.model_not_available`、`provider.output_truncated`、`provider.capability_unsupported`。
- enterprise 专项错误码至少预留：`enterprise.environment_unhealthy`、`enterprise.release_guard_failed`、`enterprise.audit_export_denied`。
