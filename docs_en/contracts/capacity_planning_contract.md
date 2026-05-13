# Capacity Planning Contract

## 1. Scope

This contract defines `§67`'s capacity tracking, forecasting models, and what-if capacity simulation.

## 2. Canonical Objects

- `CapacitySignal`
- `CapacityForecast`
- `CapacityScenario`
- `CapacityRecommendation`

## 3. `CapacitySignal` Minimum Fields

- `tenant_id`
- `harness_run_id?`
- `resource_type`
- `region_id?`
- `timestamp`
- `usage`
- `queue_depth?`
- `error_budget_burn?`

## 4. Rules

- Capacity forecasts must preserve training windows and confidence intervals.
- What-if simulations must be able to compare multiple capacity increase / decrease scenarios.
- Capacity recommendations must consider both cost and SLO risk.

## 5. Testing Requirements

- unit: trend analysis, forecast, scenario simulation
- integration: runtime metrics -> forecast -> recommendation
- contract: forecasts without time windows must not enter the decision chain
