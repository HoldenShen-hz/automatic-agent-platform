# App Error Contract

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

本 contract 定义平台统一错误模型。

它要求所有传播到 runtime、gateway、审批、恢复、观测层的错误，都必须先收敛到 `AppError`。

## 2. `AppError` 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | `string` | 稳定错误码 |
| `category` | `validation \| policy \| auth \| budget \| provider \| tool \| sandbox \| storage \| workflow \| runtime \| tenant \| monetization \| external \| internal` | 错误分类 |
| `retryable` | `boolean` | 是否允许自动重试 |
| `user_message` | `string` | 面向用户的安全提示 |
| `internal_details` | `json?` | 面向内部排障的细节 |
| `source` | `gateway \| runtime \| workflow \| provider \| tool \| storage \| policy` | 主要来源 |
| `trace_id` | `string?` | 链路追踪 |
| `task_id?` | `string` | 关联任务（兼容投影） |
| `harness_run_id?` | `string` | 关联 HarnessRun |
| `node_run_id?` | `string` | 关联 NodeRun |
| `caused_by?` | `string` | 上游错误码或异常引用 |
| `occurred_at` | `timestamp` | 发生时间 |

## 3. 统一规则

- 所有错误必须拥有稳定 `code`，不得只抛自由文本。
- 所有错误必须显式标记 `retryable`。
- `user_message` 与 `internal_details` 必须分离。
- provider / tool 原生错误必须先适配为 `AppError` 再进入上层。

## 4. 分类语义

| 分类 | 含义 | 默认重试建议 |
| --- | --- | --- |
| `validation` | 输入、schema、配置非法 | 否 |
| `policy` | 策略、审批、敏感动作拒绝 | 否 |
| `auth` | 身份或权限不足 | 否 |
| `budget` | 预算、配额、成本超限 | 否 |
| `provider` | LLM provider 失败 | 视错误码而定 |
| `tool` | 工具执行失败 | 视工具和幂等性而定 |
| `sandbox` | 路径、网络、隔离拒绝 | 通常否 |
| `storage` | 数据库、文件、索引失败 | 视错误码而定 |
| `workflow` | 编排、依赖、步骤不一致 | 通常否 |
| `runtime` | 运行时、沙箱、超时、恢复失败 | 视错误码而定 |
| `tenant` | 租户归属、隔离、组织边界错误 | 通常否 |
| `monetization` | entitlement、quota、ledger、billing 错误 | 视错误码而定 |
| `external` | 外部系统波动 | 视错误码而定 |
| `internal` | 未分类内部错误 | 默认否 |

## 5. 与重试与恢复的关系

- `retryable=true` 只表示允许进入重试策略，不等于一定重试。
- 重试仍需结合 `RetryPolicy`、预算剩余、工具幂等性和运行模式。
- 不可重试错误进入 dead-letter 或人工升级时，必须保留 `AppError.code`。

## 6. 标准派生类型

- `ValidationError`
- `PolicyDeniedError`
- `AuthError`
- `BudgetExceededError`
- `ProviderError`
- `ToolExecutionError`
- `SandboxError`
- `StorageError`
- `HarnessRunError`
- `NodeRunError`
- `RuntimeTimeoutError`
- `TenantBoundaryError`
- `MonetizationError`
- `InternalAppError`

## 7. 关联文档

- `error_code_registry.md`
- `runtime_execution_contract.md`
- `approval_and_hitl_contract.md`
- `tool_and_provider_execution_contract.md`

## 8. 收口结论

错误模型的核心不是“多定义几个异常类”，而是确保系统任何一层的失败都能被统一分类、统一呈现、统一恢复。
