# Workflow IO Compatibility Precheck Contract

## 1. 范围

本 contract defines workflow step 在实际运lines前的输入输出兼容预检规则。

相关文档：

- `task_and_workflow_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `tool_and_provider_execution_contract.md`

## 2. 目标

Phase 1a / 1b 的最小预检目标is：

- 尽早发现 step 间 key 缺失或命名inconsistent。
- 在真正执lines前阻断明显的 schema 不兼容。
- 把当前 deterministic rule-only 能力vs未来 semantic precondition 分开。

## 3. `WorkflowIoPrecheckResult`

| 字段 | class型 | Description |
|---|-------|--------|
| `workflow_id` | `string` | workflow ID |
| `step_id` | `string` | 当前步骤 |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | 当前闭环阶段 |
| `compatible` | `boolean` | isno兼容 |
| `missing_keys` | `string[]` | 缺失关键输入 |
| `unexpected_keys` | `string[]` | 多余关键字段 |
| `schema_version` | `string?` | 参vs比较的 schema 版本 |
| `reason_code` | `string?` | 不兼容原因码 |
| `checked_at` | `timestamp` | 检查time |

## 4. 预检内容

当前阶段最少检查：

- required key isno存在
- 字段class型isnobelongs to允许集合
- 上一步输出 schema version isnovs下一步声明兼容
- references用的 tool / role isno可用
- OAPEFLIR stage 转换isno合法
- 若声明 `knowledge_namespace`，其 namespace isno存在且允许访问
- 若声明 plugin / domain tool bundle references用，isno已注册且vs domain 匹配

当前不要求：

- 自然语言语义isno真正“理解一致”
- 复杂跨步业务规则推理

## 5. 执lines时机

- workflow 创建后可做一iterations静态预检
- step 真正执lines前必须再做一iterationsbased on当前上下文的dynamically预检
- 恢复执lines时，若输入快照已变化，必须重新预检

## 6. failed语义

- 不兼容应返回 `validation.schema_mismatch`
- 缺少required key 应返回 `validation.invalid_input`
- 预检failed不得as执lines阶段错误
- stage 非法转换应返回稳定 reason code，例如 `validation.invalid_stage_transition`

## 7. vs precondition 的边界

- 本 contract 只覆盖 deterministic rule-only 检查
- semantic precondition belongs to后续增强能力，不得在 Phase 1a / 1b 假装已可用

## 8. 收口Conclusion

workflow IO 预检的目标不is做到“完全聪明”，而is把最常见、最便宜可判定的兼容Issue拦在运lines前。
