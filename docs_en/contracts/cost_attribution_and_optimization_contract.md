# Cost Attribution And Optimization Contract

## 1. Scope

This contract defines decision-level cost attribution, automatic optimization recommendations, and what-if simulation per `§64`.

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

- Cost attribution granularity must cover at minimum: harness run / node run / agent / model / domain.
- Optimization recommendations must include benefit estimates, risk explanations, and applicable scope.
- What-if simulation must not directly modify real budget state.
- If cost cannot be traced back to `HarnessRun / NodeRun / BudgetSettlement`, it must not enter automatic optimization recommendations.

## 5. Test Requirements

- unit: attribution aggregation, recommendation scoring, simulation
- integration: cost tracker -> optimizer -> dashboard
- contract: costs without sources must not be included in optimization recommendations



## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-53: This document previously left `decision_ref` as a generic string. Root cause: the cost attribution contract long treated "decision source" as a report label and did not model runtime truth and budget settlement traceability as hard constraints. Fix: The main text now converges `CostAttributionRecord` to this set of traceable references: `harness_run_id / node_run_id / budget_settlement_ref / decision_directive_ref`, and prohibits costs without truth traceability from entering automatic optimization.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.