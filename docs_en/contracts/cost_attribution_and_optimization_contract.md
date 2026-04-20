# Cost Attribution And Optimization Contract

## 1. Scope

This contract defines decision-level cost attribution, automated optimization recommendations, and what-if simulation for `§64`.

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
- `decision_ref`
- `model_ref?`
- `captured_at`

## 4. Rules

- Cost attribution granularity must cover at least task / workflow / agent / model / domain.
- Optimization recommendations must include benefit estimates, risk explanations, and applicable scope.
- What-if simulation must not directly modify real budget state.

## 5. Test Requirements

- unit: attribution aggregation, recommendation scoring, simulation
- integration: cost tracker -> optimizer -> dashboard
- contract: unattributed costs must not be included in optimization recommendations