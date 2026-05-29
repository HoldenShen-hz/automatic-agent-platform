# Idempotency And Recovery Matrix Contract

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

本 contract defines工具callvs `NodeRun / NodeAttempt` 的幂等性矩阵，以及崩溃恢复时的handle策略。

## 2. 核心principle

- 任何自动重试都必须先via过幂等性判断。
- 任何恢复跳过都必须有已执lines证据。
- 非幂等 `NodeAttempt` defaults to不得自动重放。

## 3. 工具级矩阵

| 工具class别 | defaults to幂等性 | 已执lines检查 | 崩溃恢复策略 |
|---|-------|--------| --- |
| 只读查询 | is | 输入相同 + no副作用 | 可directly重试 |
| 文件读取 | is | 路径存在且未writes | 可directly重试 |
| 文件writes（覆盖型） | 视实现而定 | 内容 checksum / writes标记 | 校验后跳过或重写 |
| 文件追加 | no | 追加标记 / 事务日志 | defaults to人工确认或显式幂等键 |
| 外部 API 查询 | 通常is | request fingerprint | 可有限重试 |
| 外部 API writes | no | 外部资源 id / idempotency key | defaults to不得自动重试 |
| LLM 推理 | is | response cache 或 execution lineage | 可重试，但成本需重算 |
| artifact writes | 视策略而定 | artifact checksum / path | 已存在且校验via可跳过 |

## 4. NodeRun / NodeAttempt 级矩阵

| Node 语义class型 | 幂等性 | 恢复时策略 |
|---|-------|--------|
| 纯推理 / 规划 | 高 | 可重跑 |
| schema 校验 | 高 | 可重跑 |
| 只读工具节点 | 高 | 可重跑 |
| Observe / Assess | 高 | 可重跑 |
| Feedback / Learn | 中 | 允许based on evidence 重建，但不得repeats消费已终态对象 |
| 文件生成节点 | 中 | 校验 artifact 后跳过或重跑 |
| Improve candidate evaluation | 低 | defaults to阻断自动恢复，需 guardrail / lineage 校验 |
| Release rollout transition | 低 | defaults to阻断自动恢复，优先人工确认或受控 rollback |
| 外部副作用节点 | 低 | defaults to阻断自动恢复 |
| 审批等待节点 | 高 | 重建等待态 |
| 流式展示节点 | 中 | 可回放阶段性结果，不重建全部 chunk |

规则：

- canonical 恢复对象is `NodeRun` vs `NodeAttempt`；`step_id`、`workflow step`、`agent step` 只允许作为 plan graph 里的语义标签或展示投影。
- 自动恢复前必须先校验最近一iterations `NodeAttemptReceipt`，不得only凭“步骤名称相同”判断可跳过。

## 5. Tool 元data要求

每个工具最终至少应声明：

- `read_only`
- `idempotent`
- `side_effect_scope`
- `requires_confirmation`
- `recovery_strategy`

更细的字段、消费方和版本化规则以下钻文档 `tool_metadata_and_recovery_contract.md` 为准。

`recovery_strategy` Recommendation枚举：

- `retry_safe`
- `retry_with_check`
- `skip_if_verified`
- `manual_resume_required`

## 6. Phase 1a 最小要求

Phase 1a 不追求完整自动判断，但至少要做到：

- 区分只读vs有副作用工具
- 区分可security自动重试vs不可自动重试节点
- 对有副作用节点保留已执lines证据或明确阻断恢复

## 7. 关联文档

- `runtime_execution_contract.md`
- `tool_and_provider_execution_contract.md`
- `task_and_workflow_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 8. 收口Conclusion

恢复能力的核心不is“能不能再跑一iterations”，而is知道哪些 `NodeRun / NodeAttempt` 可以security再跑，哪些必须先确认“is不is已via做过了”。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-37: 本文原先把恢复矩阵建立在 `workflow step / step` 上，Root cause: 早期线性 workflow 文档directly被accesses along用到恢复合同，`NodeRun / NodeAttempt / NodeAttemptReceipt` 成为 runtime truth 后正文仍停留在 step 视角。修复：正文现把 canonical 恢复对象改为 `NodeRun / NodeAttempt`，并明确 `step_id` 只允许作为语义标签或展示投影。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
