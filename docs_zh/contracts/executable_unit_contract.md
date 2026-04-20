# Executable Unit Contract

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

本 contract 定义平台内统一的“可执行单元”抽象，用于收敛 Task、WorkflowStep、Skill Step、Tool Call、DecisionRequest、SubTask 等异构执行对象。

相关文档：

- `task_and_workflow_contract.md`
- `runtime_execution_contract.md`
- `transition_service_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 2. 目标

统一执行单元的目的是让以下能力复用同一抽象：

- 调度
- 超时
- 重试
- 恢复
- 审计
- 计费
- 可视化

## 3. `ExecutableUnit`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `unit_id` | `string` | 单元 ID |
| `unit_kind` | `task \| workflow_step \| skill_step \| tool_call \| decision_request \| subtask \| observe_step \| assess_step \| feedback_step \| learn_step \| improve_step \| release_step \| knowledge_retrieval \| memory_promotion` | 单元类型 |
| `parent_unit_id` | `string?` | 父执行单元 |
| `root_task_id` | `string` | 根任务 ID |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | 所属闭环阶段 |
| `ref_id` | `string?` | 关联 typed ref |
| `input_ref` | `string \| json` | 输入引用或输入体 |
| `output_ref` | `string?` | 输出引用 |
| `status` | `string` | 生命周期状态 |
| `retry_policy_ref` | `string?` | 重试策略 |
| `timeout_ms` | `number?` | 超时 |
| `dependency_refs` | `string[]?` | 依赖单元 |
| `side_effect_level` | `none \| local \| external \| financial \| org_mutation` | 副作用等级 |
| `cost_scope_ref` | `string?` | 成本归属 |
| `created_at` | `timestamp` | 创建时间 |

## 4. 约束

- 统一执行单元是抽象层，不替代具体领域对象。
- `Task` 仍然是用户主对象，`ExecutableUnit` 是跨对象复用的执行视图。
- 执行调度、超时、恢复和审计优先消费统一执行单元，而不是为每个对象重复定义一套接口。

## 5. 当前阶段映射

| 领域对象 | 映射方式 |
| --- | --- |
| `Task` | 顶层用户可见执行单元 |
| `WorkflowStep` | workflow 内部执行单元 |
| `ToolCall` | 最细粒度原子执行单元 |
| `DecisionRequest` | 阻塞型执行单元 |
| `SubTask` | 子树型执行单元 |
| `Observe / Assess / Feedback / Learn / Improve / Release` | 闭环阶段执行单元 |

## 6. Phase 边界

Phase 1a / 1b 做：

- 文档与运行概念层统一抽象
- 用于调度、超时、恢复和可视化设计

当前不做：

- 单独新建一套独立存储表强行替代现有 task / execution / step 表

## 7. 收口结论

统一执行单元不是为了再造一层概念，而是为了减少“同一类调度逻辑在五六种对象上重复实现”的未来成本。
