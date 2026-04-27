# Data Classification And Prompt Handling Contract

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

本 contract 定义数据分级，以及不同等级数据是否允许进入 prompt、日志、memory、跨 worker 传输。

相关文档：

- `sandbox_and_auth_contract.md`
- `tool_output_sanitization_contract.md`
- `tenant_and_organization_contract.md`

## 2. 数据分级

- `public`
- `internal`
- `confidential`
- `restricted`

## 3. 控制维度

每个等级至少要约束：

- 是否允许进入 prompt
- 是否允许写日志
- 是否允许跨 worker 传输
- 是否允许进入 memory
- 是否允许进入 Knowledge Plane
- 是否允许进入高层 memory（L5/L6）
- 是否允许进入 feedback / learning 对象
- 是否允许进入 artifact
- 是否允许进入 debug / inspect

## 4. 最小映射规则

| 等级 | prompt | logs | memory | artifact | cross-worker |
| --- | --- | --- | --- | --- | --- |
| `public` | 允许 | 允许 | 允许 | 允许 | 允许 |
| `internal` | 允许 | 允许脱敏后 | 允许 | 允许 | 受控允许 |
| `confidential` | 受控允许 | 默认脱敏 | 受控允许 | 受控允许 | 默认拒绝或最小化 |
| `restricted` | 默认拒绝 | 默认拒绝 | 默认拒绝 | 仅受控保留 | 默认拒绝 |

## 5. 规则

- `restricted` 默认不得直接进入 prompt。
- 高风险工具输出应先做结构化提取或摘要，再决定是否入模。
- 数据等级变化必须可审计。
- `restricted` 默认不得进入 memory、debug dump 或跨 worker 传输。
- 若需要例外放行，必须由 Policy Engine 给出可审计决策。
- `restricted` 默认不得进入 Knowledge Plane 或 L5/L6 memory promotion。
- `confidential` / `restricted` 数据若进入 `LearningObject` 或 `FeedbackSignal`，必须先脱敏并保留 classification provenance。

## 6. 收口结论

不是所有文本都应该直接给模型；数据分级和入模策略控制，是长期安全与企业化的关键前置边界。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-29: 缺少架构§11.6 DataTaintPropagation 硬规则：输出 data_class 不得低于最高输入 data_class 除非有显式脱敏证明。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
