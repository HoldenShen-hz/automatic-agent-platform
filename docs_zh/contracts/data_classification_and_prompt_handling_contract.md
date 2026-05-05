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
- **Improve**：改进候选评估与 release
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
- `taint_labels` 如何传播
- 是否需要字段级 redaction report

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

### 5.1 DataTaintPropagation 硬规则

`DataTaintPropagationRecord` 最少字段：

- `input_data_classes`
- `max_input_data_class`
- `output_data_class`
- `taint_labels`
- `redaction_report_ref?`
- `desensitization_evidence_ref?`
- `reviewer_decision_ref?`

硬规则：

- 任意输出、artifact、memory candidate、tool result、summary、prompt execution record、delegation result 或 explanation artifact 的 `output_data_class`，不得低于其输入集合中的最高 `data_class`。
- 唯一例外是存在显式脱敏证明、字段级 `redaction_report`，以及 reviewer / policy evidence 三者同时齐备。
- `taint_labels` 必须随 `ToolOutput`、`PromptExecutionRecord`、`MemoryWriteRequest`、`FeedbackSignal`、`LearningObject` 和 explanation artifact 一起传播，不得在中间摘要层丢失。
- 若下游对象缺少 taint propagation 元数据，系统必须 fail-closed 或保守提升 `output_data_class`，不得默认降级为 `internal` 或 `public`。

### 5.2 降级证明要求

允许数据等级下降时，至少要保留：

- 哪些字段被删除、掩码或泛化
- 使用了哪套脱敏策略
- 谁批准了该降级
- 对应的 policy / reviewer evidence 引用

规则：

- 没有 `redaction_report_ref` 的等级下降一律视为 contract 违规。
- `public` / `internal` 的 summary 若来源于 `confidential` / `restricted` 输入，也必须保留可审计降级证明，而不是只看最终文本是否“看起来安全”。

## 6. 收口结论

不是所有文本都应该直接给模型；数据分级和入模策略控制，是长期安全与企业化的关键前置边界。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-29: 本文原先只定义了“某等级能不能进入 prompt/log/memory”的静态表，没有定义输入到输出之间的 taint 传播硬规则，根因是早期数据分级文档偏重存取矩阵，遗漏了摘要、tool result、memory candidate 等派生对象的降级证明链。修复：正文现补入 `DataTaintPropagationRecord`，并明确“输出 `data_class` 不得低于最高输入等级，除非具备脱敏证明 + redaction report + reviewer/policy evidence”。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
