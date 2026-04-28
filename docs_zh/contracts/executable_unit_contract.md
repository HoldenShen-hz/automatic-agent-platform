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

本 contract 定义平台内统一的“可执行单元”语义视图，用于把 Task、WorkflowStep、Tool Call、HITL 决策、SubTask 等异构对象映射到统一观察与可视化层。

`ExecutableUnit` 不是 runtime truth。v4.3 的规范最小执行单元是 `NodeRun` / `NodeAttempt`；`ExecutableUnit` 只能作为围绕它们构建的语义投影或导入适配层。

相关文档：

- `task_and_workflow_contract.md`
- `runtime_execution_contract.md`
- `transition_service_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 2. 目标

统一执行单元的目的是让以下能力复用同一语义视图：

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
| `unit_kind` | `task_view \| workflow_step_view \| tool_call_view \| hitl_wait_view \| subtask_view \| release_gate_view \| knowledge_retrieval_view \| memory_promotion_view` | 语义视图类型 |
| `harness_run_id` | `string` | 对应 HarnessRun |
| `node_run_id` | `string?` | 对应 NodeRun |
| `attempt_id` | `string?` | 对应 NodeAttempt |
| `plan_graph_bundle_id` | `string?` | 对应执行图 bundle |
| `graph_version` | `number?` | 对应图版本 |
| `parent_unit_id` | `string?` | 父执行单元 |
| `root_task_id` | `string?` | 根任务查询入口 |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | 所属闭环阶段视图 |
| `ref_id` | `string?` | 关联 typed ref |
| `input_ref` | `string \| json` | 输入引用或输入体 |
| `output_ref` | `string?` | 输出引用 |
| `status_view` | `string` | 生命周期投影状态 |
| `retry_policy_ref` | `string?` | 重试策略 |
| `timeout_ms` | `number?` | 超时 |
| `dependency_refs` | `string[]?` | 依赖单元 |
| `side_effect_level` | `none \| local \| external \| financial \| org_mutation` | 副作用等级 |
| `cost_scope_ref` | `string?` | 成本归属 |
| `created_at` | `timestamp` | 创建时间 |

规则：

- `ExecutableUnit` 必须能回链到 `NodeRun` / `NodeAttempt`；没有 `harness_run_id` 的新单元对象不得作为执行层 canonical 输入。
- `stage_view_ref`、`status_view` 只允许表达投影语义；真实执行状态仍由 `RuntimeStateMachine.transition(command)` 和 `NodeAttemptReceipt` 定义。
- `skill_step`、`decision_request`、`observe_step` 等旧 `unit_kind` 只能作为导入映射，不得出现在新 schema 中。

## 4. 约束

- 统一执行单元是抽象层，不替代具体领域对象。
- `Task` 仍然是用户主对象，`ExecutableUnit` 是跨对象复用的语义/展示视图。
- 执行调度、超时、恢复和 truth 审计优先消费 `NodeRun` / `NodeAttempt` / `NodeAttemptReceipt`；`ExecutableUnit` 只用于跨对象统一展示、检索或导入。

## 5. 当前阶段映射

| 领域对象 | 映射方式 |
| --- | --- |
| `Task` | 顶层用户可见执行单元视图 |
| `WorkflowStep` | `PlanNode` / `NodeRun` 的语义映射视图 |
| `ToolCall` | `NodeAttemptReceipt(receiptKind=tool)` 的原子视图 |
| `DecisionRequest` | `hitl_wait_view`，需回链到 `ApprovalRequest` / `DecisionDirective` |
| `SubTask` | 子树型运行视图，需回链到 child `HarnessRun` |
| `Observe / Assess / Feedback / Learn / Improve / Release` | OAPEFLIR 阶段视图，不是独立 truth 单元 |

## 6. Phase 边界

Phase 1a / 1b 做：

- 文档与运行概念层统一抽象
- 用于调度、超时、恢复和可视化设计

当前不做：

- 单独新建一套独立存储表强行替代现有 `HarnessRun / NodeRun / NodeAttempt` truth 表

## 7. 收口结论

统一执行单元不是为了再造一层概念，而是为了减少“同一类调度逻辑在五六种对象上重复实现”的未来成本。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-20: 本文原先把 `ExecutableUnit` 写成可直接替代 task/workflow_step/tool_call 的统一执行 truth，根因是早期想用一个抽象抹平所有执行对象，却没有随着 `NodeRun / NodeAttempt` 成为规范最小执行单元而把它降回投影层。修复：正文现明确 `ExecutableUnit` 只是围绕 `HarnessRun / NodeRun / NodeAttempt` 的语义视图，并把旧 `unit_kind` 降为导入映射。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
