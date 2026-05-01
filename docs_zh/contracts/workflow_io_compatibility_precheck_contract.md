# Workflow IO Compatibility Precheck Contract

## 1. 范围

本 contract 定义 workflow step 在实际运行前的输入输出兼容预检规则。

相关文档：

- `task_and_workflow_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `tool_and_provider_execution_contract.md`

## 2. 目标

Phase 1a / 1b 的最小预检目标是：

- 尽早发现 step 间 key 缺失或命名不一致。
- 在真正执行前阻断明显的 schema 不兼容。
- 把当前 deterministic rule-only 能力与未来 semantic precondition 分开。

## 3. `WorkflowIoPrecheckResult`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `harness_run_id` | `string` | HarnessRun ID |
| `plan_graph_bundle_id` | `string` | PlanGraphBundle ID |
| `node_run_id` | `string` | 当前 NodeRun ID |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | 当前闭环阶段 |
| `compatible` | `boolean` | 是否兼容 |
| `missing_keys` | `string[]` | 缺失关键输入 |
| `unexpected_keys` | `string[]` | 多余关键字段 |
| `schema_version` | `string?` | 参与比较的 schema 版本 |
| `reason_code` | `string?` | 不兼容原因码 |
| `checked_at` | `timestamp` | 检查时间 |

规则：

- `harness_run_id` / `plan_graph_bundle_id` / `node_run_id` 为 canonical 关联键。
- `workflow_id` / `step_id` 为 legacy 查询键，仅用于兼容接口。

## 4. 预检内容

当前阶段最少检查：

- required key 是否存在
- 字段类型是否属于允许集合
- 上一步输出 schema version 是否与下一步声明兼容
- 引用的 tool / role 是否可用
- OAPEFLIR stage 转换是否合法
- PlanGraphBundle 节点是否可执行
- NodeRun 输入/输出与 PlanGraph schema 是否匹配
- 若声明 `knowledge_namespace`，其 namespace 是否存在且允许访问
- 若声明 plugin / domain tool bundle 引用，是否已注册且与 domain 匹配

当前不要求：

- 自然语言语义是否真正“理解一致”
- 复杂跨步业务规则推理

## 5. 执行时机

- workflow 创建后可做一次静态预检
- step 真正执行前必须再做一次基于当前上下文的动态预检
- 恢复执行时，若输入快照已变化，必须重新预检

## 6. 失败语义

- 不兼容应返回 `validation.schema_mismatch`
- 缺少必需 key 应返回 `validation.invalid_input`
- 预检失败不得伪装成执行阶段错误
- stage 非法转换应返回稳定 reason code，例如 `validation.invalid_stage_transition`

## 7. 与 precondition 的边界

- 本 contract 只覆盖 deterministic rule-only 检查
- semantic precondition 属于后续增强能力，不得在 Phase 1a / 1b 假装已可用

## 8. 收口结论

workflow IO 预检的目标不是做到”完全聪明”，而是把最常见、最便宜可判定的兼容问题拦在运行前。

## v4.3 Contract Remediation

- T-43: 早期预检结果以 `workflow_id` / `step_id` 为主键。v4.3 canonical 预检应关联到 `plan_graph_bundle_id` / `node_run_id`；`workflow_id` / `step_id` 仅保留用于兼容 legacy 接口。新实现不得再以 `workflow_id` / `step_id` 为主关联键。
