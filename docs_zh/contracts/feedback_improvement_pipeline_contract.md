# Feedback Improvement Pipeline Contract

## 1. 范围

本 contract 定义 `§56` 的反馈采集、预处理、改进候选与安全护栏。

## 2. Canonical 对象

- `FeedbackSignal`
- `SignalPreprocessRecord`
- `ImprovementCandidate`
- `ImprovementReviewDecision`
- `FeedbackLoopSnapshot`

## 3. `FeedbackSignal` 最小字段

- `signal_id`
- `source_type`
- `subject_type`
- `subject_id`
- `payload`
- `severity`
- `captured_at`

## 4. 改进候选

`ImprovementCandidate` 最小字段：

- `candidate_id`
- `candidate_type`
- `source_signal_ids`
- `proposed_change`
- `risk_assessment`
- `review_status`

## 5. 规则

- 反馈信号进入改进前必须经过归一化与去重。
- 自动改进不得绕过 release / approval / policy gate。
- 所有改进候选都必须可追溯到源信号。

## 6. 测试要求

- unit：signal normalization、candidate generation、dedup
- integration：feedback -> candidate -> release review
- contract：无来源信号的 candidate 不得进入发布链

## 7. 关联与导出规则

- `FeedbackSignal`、`SignalPreprocessRecord`、`ImprovementCandidate` 对外导出时，必须补齐 `harness_run_id`、`node_run_id?`、`evidence_refs?`、`policy_gate_ref?` 等 runtime lineage 字段或等价引用。
- `ImprovementReviewDecision` 不得只引用 candidate 自身；必须能回链到源信号与对应 release / approval / guardrail 决策。
- legacy `task_id`、`execution_id` 只允许作为历史查询 alias，不得代替 canonical runtime 关联链。
- 任意自动改进若缺少 evidence 或 risk assessment，必须在 candidate 阶段被阻断，而不是拖到 release 才失败。
- feedback 去重、candidate 生成和 review 决策三段必须可分别审计，不得只保留最终 candidate。

## v4.3 Contract Remediation

- T-45C: 本文早期版本不足 60 行，且只描述 feedback -> candidate 的业务流，没有补齐 v4.3 remediation 与 canonical 证据链约束。修复：本文保留 `FeedbackSignal / ImprovementCandidate` 最小对象，并明确所有改进候选必须能追溯到源信号；新实现还必须把信号与改进结果关联到 `harness_run_id` / `node_run_id` 所在的 canonical runtime 链路。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger / BudgetReservation / BudgetSettlement`。
