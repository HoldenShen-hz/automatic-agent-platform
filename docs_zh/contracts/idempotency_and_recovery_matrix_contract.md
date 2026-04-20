# Idempotency And Recovery Matrix Contract

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

本 contract 定义工具调用与 workflow step 的幂等性矩阵，以及崩溃恢复时的处理策略。

## 2. 核心原则

- 任何自动重试都必须先经过幂等性判断。
- 任何恢复跳过都必须有已执行证据。
- 非幂等步骤默认不得自动重放。

## 3. 工具级矩阵

| 工具类别 | 默认幂等性 | 已执行检查 | 崩溃恢复策略 |
| --- | --- | --- | --- |
| 只读查询 | 是 | 输入相同 + 无副作用 | 可直接重试 |
| 文件读取 | 是 | 路径存在且未写入 | 可直接重试 |
| 文件写入（覆盖型） | 视实现而定 | 内容 checksum / 写入标记 | 校验后跳过或重写 |
| 文件追加 | 否 | 追加标记 / 事务日志 | 默认人工确认或显式幂等键 |
| 外部 API 查询 | 通常是 | request fingerprint | 可有限重试 |
| 外部 API 写入 | 否 | 外部资源 id / idempotency key | 默认不得自动重试 |
| LLM 推理 | 是 | response cache 或 execution lineage | 可重试，但成本需重算 |
| artifact 写入 | 视策略而定 | artifact checksum / path | 已存在且校验通过可跳过 |

## 4. Workflow Step 级矩阵

| Step 类型 | 幂等性 | 恢复时策略 |
| --- | --- | --- |
| 纯推理 / 规划 | 高 | 可重跑 |
| schema 校验 | 高 | 可重跑 |
| 只读工具步骤 | 高 | 可重跑 |
| Observe / Assess | 高 | 可重跑 |
| Feedback / Learn | 中 | 允许基于 evidence 重建，但不得重复消费已终态对象 |
| 文件生成步骤 | 中 | 校验 artifact 后跳过或重跑 |
| Improve candidate evaluation | 低 | 默认阻断自动恢复，需 guardrail / lineage 校验 |
| Release rollout transition | 低 | 默认阻断自动恢复，优先人工确认或受控 rollback |
| 外部副作用步骤 | 低 | 默认阻断自动恢复 |
| 审批等待步骤 | 高 | 重建等待态 |
| 流式展示步骤 | 中 | 可回放阶段性结果，不重建全部 chunk |

## 5. Tool 元数据要求

每个工具最终至少应声明：

- `read_only`
- `idempotent`
- `side_effect_scope`
- `requires_confirmation`
- `recovery_strategy`

更细的字段、消费方和版本化规则以下钻文档 `tool_metadata_and_recovery_contract.md` 为准。

`recovery_strategy` 建议枚举：

- `retry_safe`
- `retry_with_check`
- `skip_if_verified`
- `manual_resume_required`

## 6. Phase 1a 最小要求

Phase 1a 不追求完整自动判断，但至少要做到：

- 区分只读与有副作用工具
- 区分可安全自动重试与不可自动重试步骤
- 对有副作用步骤保留已执行证据或明确阻断恢复

## 7. 关联文档

- `runtime_execution_contract.md`
- `tool_and_provider_execution_contract.md`
- `task_and_workflow_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 8. 收口结论

恢复能力的核心不是“能不能再跑一次”，而是知道哪些步骤可以安全再跑，哪些步骤必须先确认“是不是已经做过了”。
