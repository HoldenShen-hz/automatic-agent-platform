# Cost Attribution And Optimization Contract

## 1. Scope

This contract defines decision-level cost attribution, automatic optimization recommendations, and what-if simulation for `§64`.

## 2. Canonical Objects

- `CostAttributionRecord`
- `OptimizationRecommendation`
- `CostSimulationScenario`
- `CostDashboardSlice`

## 3. `CostAttributionRecord` Minimum Fields

- `subject_type`
- `subject_id`
- `cost_type`
- `amount_usd`
- `harness_run_id`
- `node_run_id?`
- `budget_settlement_ref?`
- `decision_directive_ref?`
- `model_ref?`
- `captured_at`

## 4. Rules

- Cost attribution granularity covers at minimum harness run / node run / agent / model / domain.
- Optimization recommendations must include benefit estimates, risk explanations, and applicable scope.
- What-if simulation must not directly modify real budget state.
- If cost cannot be traced back to `HarnessRun / NodeRun / BudgetSettlement`, must not enter automatic optimization recommendations.

## 5. Testing Requirements

- unit: attribution aggregation, recommendation scoring, simulation
- integration: cost tracker -> optimizer -> dashboard
- contract: costs without source must not be counted in optimization recommendations



## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-53: This document originally left `decision_ref` as a general string. Root cause: Cost attribution contract has long treated "decision source" as a report label and did not model runtime truth and budget settlement back-linking as hard constraints. Fix: The body now converges `CostAttributionRecord` to the traceable reference group of `harness_run_id / node_run_id / budget_settlement_ref / decision_directive_ref`, and prohibits costs without truth back-linking from entering automatic optimization.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.