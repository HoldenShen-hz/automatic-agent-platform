# Executable Unit Contract

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

本 contract defines平台内统一的“可执lines单元”语义视图，used for把 Task、WorkflowStep、Tool Call、HITL Decision、SubTask 等异构对象映射到统一观察vs可视化层。

`ExecutableUnit` 不is runtime truth。v4.3 的规范最小执lines单元is `NodeRun` / `NodeAttempt`；`ExecutableUnit` 只能作为围绕它们构建的语义投影或import适配层。

相关文档：

- `task_and_workflow_contract.md`
- `runtime_execution_contract.md`
- `transition_service_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 2. 目标

统一执lines单元的目的is让以下能力复用同一语义视图：

- 调度
- timeout
- 重试
- 恢复
- 审计
- 计费
- 可视化

## 3. `ExecutableUnit`

| 字段 | class型 | Description |
|---|-------|--------|
| `unit_id` | `string` | 单元 ID |
| `unit_kind` | `task_view \| workflow_step_view \| tool_call_view \| hitl_wait_view \| subtask_view \| release_gate_view \| knowledge_retrieval_view \| memory_promotion_view` | 语义视图class型 |
| `harness_run_id` | `string` | 对应 HarnessRun |
| `node_run_id` | `string?` | 对应 NodeRun |
| `attempt_id` | `string?` | 对应 NodeAttempt |
| `plan_graph_bundle_id` | `string?` | 对应执lines图 bundle |
| `graph_version` | `number?` | 对应图版本 |
| `parent_unit_id` | `string?` | 父执lines单元 |
| `root_task_id` | `string?` | 根任务查询入口 |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | 所属闭环阶段视图 |
| `ref_id` | `string?` | 关联 typed ref |
| `input_ref` | `string \| json` | 输入references用或输入体 |
| `output_ref` | `string?` | 输出references用 |
| `status_view` | `string` | 生命cycle投影Status |
| `retry_policy_ref` | `string?` | 重试策略 |
| `timeout_ms` | `number?` | timeout |
| `dependency_refs` | `string[]?` | relies on单元 |
| `side_effect_level` | `none \| local \| external \| financial \| org_mutation` | 副作用等级 |
| `cost_scope_ref` | `string?` | 成本归属 |
| `created_at` | `timestamp` | 创建time |

规则：

- `ExecutableUnit` 必须能回链到 `NodeRun` / `NodeAttempt`；没有 `harness_run_id` 的新单元对象不得作为执lines层 canonical 输入。
- `stage_view_ref`、`status_view` 只允许table达投影语义；真实执linesStatus仍由 `RuntimeStateMachine.transition(command)` 和 `NodeAttemptReceipt` defines。
- `skill_step`、`decision_request`、`observe_step` 等旧 `unit_kind` 只能作为import映射，不得出现在新 schema 中。

## 4. 约束

- 统一执lines单元is抽象层，不替代具体领域对象。
- `Task` 仍然isuser主对象，`ExecutableUnit` is跨对象复用的语义/展示视图。
- 执lines调度、timeout、恢复和 truth 审计优先消费 `NodeRun` / `NodeAttempt` / `NodeAttemptReceipt`；`ExecutableUnit` 只used for跨对象统一展示、检索或import。

## 5. 当前阶段映射

| 领域对象 | 映射方式 |
| --- | --- |
| `Task` | 顶层user可见执lines单元视图 |
| `WorkflowStep` | `PlanNode` / `NodeRun` 的语义映射视图 |
| `ToolCall` | `NodeAttemptReceipt(receiptKind=tool)` 的原子视图 |
| `DecisionRequest` | `hitl_wait_view`，需回链到 `ApprovalRequest` / `DecisionDirective` |
| `SubTask` | 子树型运lines视图，需回链到 child `HarnessRun` |
| `Observe / Assess / Feedback / Learn / Improve / Release` | OAPEFLIR 阶段视图，不is独立 truth 单元 |

## 6. Phase 边界

Phase 1a / 1b 做：

- 文档vs运lines概念层统一抽象
- used for调度、timeout、恢复和可视化设计

当前不做：

- 单独新建一套独立storagetable强lines替代现有 `HarnessRun / NodeRun / NodeAttempt` truth table

## 7. 收口Conclusion

统一执lines单元不is为了再造一层概念，而is为了减少“同一class调度逻辑在五六种对象上repeats实现”的未来成本。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-20: 本文原先把 `ExecutableUnit` 写成可directly替代 task/workflow_step/tool_call 的统一执lines truth，Root cause: 早期想用一个抽象抹平所有执lines对象，却没有随着 `NodeRun / NodeAttempt` 成为规范最小执lines单元而把它降回投影层。修复：正文现明确 `ExecutableUnit` 只is围绕 `HarnessRun / NodeRun / NodeAttempt` 的语义视图，并把旧 `unit_kind` 降为import映射。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
