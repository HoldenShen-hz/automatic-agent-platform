# Capacity Planning Contract

## 1. Scope

This contract defines capacity tracking, forecasting models, and what-if capacity simulation for `§67`.

## 2. Canonical Objects

- `CapacitySignal`
- `CapacityForecast`
- `CapacityScenario`
- `CapacityRecommendation`

## 3. `CapacitySignal` Minimum Fields

- `resource_type`
- `region_id?`
- `timestamp`
- `usage`
- `queue_depth?`
- `error_budget_burn?`

## 4. Rules

- Capacity forecasts must preserve training window and confidence intervals.
- What-if simulation must support comparing multiple scale-up / scale-down scenarios.
- Capacity recommendations must consider both cost and SLO risk.

## 5. Test Requirements

- unit: trend analysis, forecast, scenario simulation
- integration: runtime metrics -> forecast -> recommendation
- contract: forecasts without time window must not enter the decision chain