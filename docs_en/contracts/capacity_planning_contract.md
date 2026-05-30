# Capacity Planning Contract

## 1. Scope

This contract defines `§67`'s capacity tracking, forecasting model, and what-if capacity simulation.

## 2. Canonical Objects

- `CapacitySignal`
- `CapacityForecast`
- `CapacityAlert`
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

- Capacity forecasting must retain training window and confidence interval.
- `CapacityAlert` must explicitly point out triggered threshold, affected resources, and recommended actions.
- What-if simulation must be able to compare multiple capacity increase / decrease scenarios.
- Capacity recommendation must consider both cost and SLO risk.

## 5. Testing Requirements

- unit: trend analysis, forecast, scenario simulation
- integration: runtime metrics -> forecast -> recommendation
- contract: forecast output without time window must not enter decision chain