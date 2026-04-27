# Feedback Improvement Pipeline Contract

## 1. Scope

This contract defines feedback collection, preprocessing, improvement candidate, and safety guardrails for `§56`.

## 2. Canonical Objects

- `FeedbackSignal`
- `SignalPreprocessRecord`
- `ImprovementCandidate`
- `ImprovementReviewDecision`
- `FeedbackLoopSnapshot`

## 3. FeedbackSignal Minimum Fields

- `signal_id`
- `source_type`
- `subject_type`
- `subject_id`
- `payload`
- `severity`
- `captured_at`

## 4. Improvement Candidate

`ImprovementCandidate` minimum fields:

- `candidate_id`
- `candidate_type`
- `source_signal_ids`
- `proposed_change`
- `risk_assessment`
- `review_status`

## 5. Rules

- Feedback signals must be normalized and deduplicated before entering improvement.
- Automatic improvement must not bypass rollout / approval / policy gate.
- All improvement candidates must be traceable to source signals.

## 6. Test Requirements

- unit: signal normalization, candidate generation, dedup
- integration: feedback -> candidate -> rollout review
- contract: candidates without source signals must not enter release chain
