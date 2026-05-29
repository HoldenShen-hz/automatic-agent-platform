# Feedback Improvement Pipeline Contract

## 1. 范围

本 contract defines `§56` 的反馈采集、预handle、改进候选vssecurity护栏。

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

- 反馈信号进入改进前必须via过归一化vsfor deduplication。
- 自动改进不得bypassing rollout / approval / policy gate。
- 所有改进候选都必须可追溯到源信号。

## 6. 测试要求

- unit：signal normalization、candidate generation、dedup
- integration：feedback -> candidate -> rollout review
- contract：no来源信号的 candidate 不得进入发布链

