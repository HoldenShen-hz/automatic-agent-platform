# App Error Contract

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

本 contract defines平台统一错误模型。

它要求所有传播到 runtime、gateway、审批、恢复、观测层的错误，都必须先收敛到 `AppError`。

## 2. `AppError` 最小字段

| 字段 | class型 | Description |
|---|-------|--------|
| `code` | `string` | 稳定错误码 |
| `category` | `validation \| policy \| auth \| budget \| provider \| tool \| sandbox \| storage \| workflow \| runtime \| tenant \| monetization \| external \| internal` | 错误分class |
| `retryable` | `boolean` | isno允许自动重试 |
| `user_message` | `string` | 面向user的security提示 |
| `internal_details` | `json?` | 面向内部排障的细节 |
| `source` | `gateway \| runtime \| workflow \| provider \| tool \| storage \| policy` | 主要来源 |
| `trace_id` | `string?` | 链路追踪 |
| `task_id?` | `string` | 关联任务（兼容投影） |
| `harness_run_id?` | `string` | 关联 HarnessRun |
| `node_run_id?` | `string` | 关联 NodeRun |
| `execution_id?` | `string` | legacy execution 投影键 |
| `caused_by?` | `string` | 上游错误码或异常references用 |
| `occurred_at` | `timestamp` | 发生time |

## 3. 统一规则

- 所有错误必须拥有稳定 `code`，不得只抛自由文本。
- 所有错误必须显式标记 `retryable`。
- `user_message` vs `internal_details` 必须分离。
- provider / tool 原生错误必须先适配为 `AppError` 再进入上层。

## 4. 分class语义

| 分class | 含义 | defaults to重试Recommendation |
|---|-------|--------|
| `validation` | 输入、schema、configure非法 | no |
| `policy` | 策略、审批、敏感动作拒绝 | no |
| `auth` | 身份或permission不足 | no |
| `budget` | budget、配额、成本exceeds限 | no |
| `provider` | LLM provider failed | 视错误码而定 |
| `tool` | 工具执linesfailed | 视工具和幂等性而定 |
| `sandbox` | 路径、network、隔离拒绝 | 通常no |
| `storage` | data库、文件、索referencesfailed | 视错误码而定 |
| `workflow` | 编排、relies on、步骤inconsistent | 通常no |
| `runtime` | 运lines时、沙箱、timeout、恢复failed | 视错误码而定 |
| `tenant` | 租户归属、隔离、组织边界错误 | 通常no |
| `monetization` | entitlement、quota、ledger、billing 错误 | 视错误码而定 |
| `external` | 外部系统波动 | 视错误码而定 |
| `internal` | 未分class内部错误 | defaults tono |

## 5. vs重试vs恢复的关系

- `retryable=true` 只table示允许进入重试策略，不等于一定重试。
- 重试仍需结合 `RetryPolicy`、budget剩余、工具幂等性和运lines模式。
- 不可重试错误进入 dead-letter 或人工升级时，必须保留 `AppError.code`。

## 6. 标准派生class型

- `ValidationError`
- `PolicyDeniedError`
- `AuthError`
- `BudgetExceededError`
- `ProviderError`
- `ToolExecutionError`
- `SandboxError`
- `StorageError`
- `WorkflowStateError`
- `RuntimeTimeoutError`
- `TenantBoundaryError`
- `MonetizationError`
- `InternalAppError`

## 7. 关联文档

- `error_code_registry.md`
- `runtime_execution_contract.md`
- `approval_and_hitl_contract.md`
- `tool_and_provider_execution_contract.md`

## 8. 收口Conclusion

错误模型的核心不is“多defines几个异常class”，而is确保系统任何一层的failed都能被统一分class、统一呈现、统一恢复。
