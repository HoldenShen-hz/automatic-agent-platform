# Data Classification And Prompt Handling Contract

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

本 contract definesdata分级，以及不同等级dataisno允许进入 prompt、日志、memory、跨 worker 传输。

相关文档：

- `sandbox_and_auth_contract.md`
- `tool_output_sanitization_contract.md`
- `tenant_and_organization_contract.md`

## 2. data分级

- `public`
- `internal`
- `confidential`
- `restricted`

## 3. 控制维度

每个等级至少要约束：

- isno允许进入 prompt
- isno允许写日志
- isno允许跨 worker 传输
- isno允许进入 memory
- isno允许进入 Knowledge Plane
- isno允许进入高层 memory（L5/L6）
- isno允许进入 feedback / learning 对象
- isno允许进入 artifact
- isno允许进入 debug / inspect
- `taint_labels` 如何传播
- isno需要字段级 redaction report

## 4. 最小映射规则

| 等级 | prompt | logs | memory | artifact | cross-worker |
|---|-------|--------| --- | --- | --- |
| `public` | 允许 | 允许 | 允许 | 允许 | 允许 |
| `internal` | 允许 | 允许脱敏后 | 允许 | 允许 | 受控允许 |
| `confidential` | 受控允许 | defaults to脱敏 | 受控允许 | 受控允许 | defaults to拒绝或最小化 |
| `restricted` | defaults to拒绝 | defaults to拒绝 | defaults to拒绝 | only受控保留 | defaults to拒绝 |

## 5. 规则

- `restricted` defaults to不得directly进入 prompt。
- 高风险工具输出应先做结构化提取或摘要，再决定isno入模。
- data等级变化必须可审计。
- `restricted` defaults to不得进入 memory、debug dump 或跨 worker 传输。
- 若需要例外放lines，必须由 Policy Engine 给出可审计Decision。
- `restricted` defaults to不得进入 Knowledge Plane 或 L5/L6 memory promotion。
- `confidential` / `restricted` data若进入 `LearningObject` 或 `FeedbackSignal`，必须先脱敏并保留 classification provenance。

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
- 唯一例外is存在显式脱敏证明、字段级 `redaction_report`，以及 reviewer / policy evidence 三者同时齐备。
- `taint_labels` 必须随 `ToolOutput`、`PromptExecutionRecord`、`MemoryWriteRequest`、`FeedbackSignal`、`LearningObject` 和 explanation artifact 一起传播，不得在中间摘要层丢失。
- 若下游对象缺少 taint propagation 元data，系统必须 fail-closed 或保守提升 `output_data_class`，不得defaults to降级为 `internal` 或 `public`。

### 5.2 降级证明要求

允许data等级下降时，至少要保留：

- 哪些字段被删除、掩码或泛化
- uses了哪套脱敏策略
- 谁批准了该降级
- 对应的 policy / reviewer evidence references用

规则：

- 没有 `redaction_report_ref` 的等级下降一律视为 contract 违规。
- `public` / `internal` 的 summary 若来源于 `confidential` / `restricted` 输入，也必须保留可审计降级证明，而不is只看最终文本isno“看起来security”。

## 6. 收口Conclusion

不is所有文本都应该directly给模型；data分级和入模策略控制，is长期securityvs企业化的关键前置边界。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-29: 本文原先只defines了“某等级能不能进入 prompt/log/memory”的静态table，没有defines输入到输出之间的 taint 传播硬规则，Root cause: 早期data分级文档偏重存取矩阵，遗漏了摘要、tool result、memory candidate 等派生对象的降级证明链。修复：正文现补入 `DataTaintPropagationRecord`，并明确“输出 `data_class` 不得低于最高输入等级，除非具备脱敏证明 + redaction report + reviewer/policy evidence”。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
