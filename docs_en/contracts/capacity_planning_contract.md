# Capacity Planning Contract

## 1. Scope

This contract defines `§67`'s capacity tracking, forecasting models, and what-if capacity simulation.

## 2. Canonical Objects

- `CapacitySignal`
- `CapacityForecast`
- `CapacityScenario`
- `CapacityRecommendation`
- `CapacityAlert`

## 3. `CapacitySignal` Minimum Fields

- `resource_type`
- `region_id?`
- `timestamp`
- `usage`
- `queue_depth?`
- `error_budget_burn?`

## 4. `CapacityAlert` Output Object

`CapacityAlert` is generated when predicted capacity breaches a threshold within the forecast horizon.

Minimum fields:

- `alert_id` — unique identifier
- `resource_type` — type of resource (cpu, memory, storage, bandwidth, etc.)
- `region_id?` — optional region
- `forecast_horizon` — time window for predicted breach
- `predicted_value` — predicted usage value
- `threshold_value` — threshold that would be breached
- `severity` (`warning | critical`)
- `recommended_action` — mitigation recommendation
- `created_at` — alert generation time

Rules:
- `CapacityAlert` is an output of forecast threshold evaluation; it is not a `CapacitySignal` input.
- Alerts must reference the underlying `CapacityForecast` that triggered them.

## 4. Rules

- Capacity forecasts must preserve training windows and confidence intervals.
- What-if simulations must be able to compare multiple capacity increase / decrease scenarios.
- Capacity recommendations must consider both cost and SLO risk.

## 5. Testing Requirements

- unit: trend analysis, forecast, scenario simulation
- integration: runtime metrics -> forecast -> recommendation
- contract: forecasts without time windows must not enter the decision chain
