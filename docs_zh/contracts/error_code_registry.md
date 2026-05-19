# Error Code Registry

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 rollout
- **Release**：受控发布与回滚

---

## 1. 范围

本文件定义当前阶段允许使用的稳定 `AppError.code` 注册表。

规则：

- 新的对外 `AppError.code` 进入实现前，必须先登记到这里。
- 已进入实现的对外错误码不得随意改名。
- 启动巡检、内部断言、一次性迁移诊断允许保留局部 snake_case / colon 风格，但不得冒充对外稳定 API / SDK / runtime contract error code。

## 2. 命名规则

对外稳定错误码统一格式：

- `<category>.<reason>`

示例：

- `validation.invalid_input`
- `provider.rate_limited`
- `runtime.recovery_required`

## 3. 基线错误码

| code | category | retryable | 说明 |
| --- | --- | --- | --- |
| `validation.invalid_input` | `validation` | `false` | 输入不合法或缺字段 |
| `validation.schema_mismatch` | `validation` | `false` | workflow 输入输出不兼容 |
| `policy.approval_required` | `policy` | `false` | 必须人工审批 |
| `policy.action_denied` | `policy` | `false` | 策略显式拒绝 |
| `auth.permission_denied` | `auth` | `false` | 权限不足 |
| `budget.budget_exceeded` | `budget` | `false` | 预算超限 |
| `budget.quota_exceeded` | `budget` | `false` | 配额超限 |
| `provider.rate_limited` | `provider` | `true` | provider 429 或等价限流 |
| `provider.temporary_unavailable` | `provider` | `true` | provider 暂时不可用 |
| `provider.compaction_unavailable` | `provider` | `true` | compaction / summarize provider 临时不可用 |
| `tool.execution_failed` | `tool` | `false` | 工具执行失败且不可自动重试 |
| `tool.temporary_io_error` | `tool` | `true` | 工具遇到临时 IO 问题 |
| `tool.edit_target_not_found` | `tool` | `false` | edit / patch 未找到目标 |
| `tool.edit_multiple_candidates` | `tool` | `false` | edit / patch 命中多个候选 |
| `tool.edit_similarity_too_low` | `tool` | `false` | edit / patch 模糊匹配相似度不足 |
| `tool.file_lock_conflict` | `tool` | `true` | 文件锁冲突，可等待后重试 |
| `tool.file_lock_timeout` | `tool` | `true` | 文件锁等待超时 |
| `sandbox.path_denied` | `sandbox` | `false` | 访问路径超出白名单 |
| `sandbox.network_denied` | `sandbox` | `false` | 网络访问被策略拒绝 |
| `sandbox.exec_denied` | `sandbox` | `false` | 进程执行被沙箱或策略拒绝 |
| `sandbox.isolation_broken` | `sandbox` | `false` | 隔离约束无法保证 |
| `storage.write_failed` | `storage` | `true` | 写存储失败 |
| `workflow.dependency_unavailable` | `workflow` | `true` | 上游依赖暂不可用 |
| `runtime.recovery_required` | `runtime` | `true` | 需要恢复流程 |
| `runtime.stale_lock_detected` | `runtime` | `true` | 检测到过期锁或陈旧运行 |
| `runtime.context_overflow` | `runtime` | `true` | 上下文超限需裁剪或压缩 |
| `tenant.not_found` | `tenant` | `false` | 找不到租户或工作区归属 |
| `tenant.boundary_violation` | `tenant` | `false` | 访问跨租户边界 |
| `tenant.workspace_mismatch` | `tenant` | `false` | workspace 与 tenant / org 归属不一致 |
| `external.service_unavailable` | `external` | `true` | 外部系统暂不可用 |
| `internal.unexpected_error` | `internal` | `false` | 未分类内部错误 |

## 4. 特殊映射规则

- provider 的 `429` 映射到 `provider.rate_limited`
- provider 的 `5xx` 映射到 `provider.temporary_unavailable`
- 文件锁获取冲突映射到 `tool.file_lock_conflict`
- 文件锁等待超时映射到 `tool.file_lock_timeout`

## 5. 补充规则

- provider、tool、enterprise 的扩展子码可以在实现落地后追加到注册表；未实现条目不得提前标记为 canonical。
