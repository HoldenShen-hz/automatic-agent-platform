# Feedback Improvement Pipeline Contract

## 1. Scope

This contract defines feedback collection for `§56`, preprocessing, improvement candidates, and safety guardrails.

## 2. Canonical Objects

- `FeedbackSignal`
- `SignalPreprocessRecord`
- `ImprovementCandidate`
- `ImprovementReviewDecision`
- `FeedbackLoopSnapshot`

## 3. `FeedbackSignal` Minimum Fields

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
- Automatic improvement must not bypass release / approval / policy gate.
- All improvement candidates must be traceable to source signals.

## 6. Test Requirements

- unit: signal normalization, candidate generation, dedup
- integration: feedback -> candidate -> release review
- contract: candidates without source signals must not enter release chain

## 7. Association and Export Rules

- When exporting `FeedbackSignal`, `SignalPreprocessRecord`, `ImprovementCandidate` externally, must supplement `harness_run_id`, `node_run_id?`, `evidence_refs?`, `policy_gate_ref?` and other runtime lineage fields or equivalent references.
- `ImprovementReviewDecision` must not only reference the candidate itself; must be traceable back to source signals and corresponding release / approval / guardrail decisions.
- Legacy `task_id`, `execution_id` are only allowed as historical query aliases and cannot replace canonical runtime association chain.
- Any automatic improvement lacking evidence or risk assessment must be blocked at candidate stage, not fail at release.
- The three stages of feedback deduplication, candidate generation, and review decision must be separately auditable; cannot only keep final candidate.

## v4.3 Contract Remediation

- T-45C: Early version of this document was less than 60 lines and only described the business flow of feedback -> candidate, without supplementing v4.3 remediation and canonical evidence chain constraints. Fix: This document retains `FeedbackSignal / ImprovementCandidate` minimum objects, and clarifies all improvement candidates must be traceable to source signals; new implementations must also associate signals and improvement results to canonical runtime chain where `harness_run_id` / `node_run_id` are located.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger / BudgetReservation / BudgetSettlement`.
