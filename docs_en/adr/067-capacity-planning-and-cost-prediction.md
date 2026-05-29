# ADR-067 Capacity Planning and Cost Prediction Engine

- Status: Accepted
- Decision Date: 2026-04-20

## Background

The platform needs to predict capacity requirements and cost trends, supporting forward-looking scaling decisions.

Current口径:

- Ring 1 only requires stably collecting capacity signals and forming auditable prediction inputs.
- Ring 3 enters cross-region, cross-ecosystem automatic capacity planning and strategy linkage.

## Decision

### Capacity Metrics

| Metric | Description | Collection Frequency |
|--------|-------------|---------------------|
| cpu_usage | CPU utilization | 1 minute |
| memory_usage | Memory utilization | 1 minute |
| queue_depth | Queue depth | 1 minute |
| active_tasks | Active task count | 1 minute |
| throughput | Throughput | 5 minutes |

### Prediction Models

```typescript
interface CapacityForecast {
  horizon: TimeHorizon;
  predictions: MetricPrediction[];
  confidence: number;
  recommendations: Recommendation[];
}

interface CapacityScenario {
  scenario_id: string;
  assumptions: string[];
  forecast: CapacityForecast;
}

interface CapacityAlert {
  alert_id: string;
  forecast_ref: string;
  severity: "warning" | "critical";
}

interface CapacityRecommendation {
  recommendation_id: string;
  scenario_ref: string;
  action: "scale_up" | "scale_down" | "rebalance" | "defer";
}

interface MetricPrediction {
  metric: string;
  values: TimeSeriesPoint[];
  trend: Trend;
  seasonality: Seasonality;
}
```

### Prediction Algorithms

| Algorithm | Applicable Scenario |
|-----------|-------------------|
| ARIMA | Trend prediction |
| Holt-Winters | Seasonal prediction |
| Prophet | Multi-seasonality |
| LSTM | Complex patterns |

### Scaling Recommendations

| Scenario | Recommendation |
|----------|----------------|
| Insufficient capacity | Add Workers |
| Resource waste | Reduce resources |
| Performance bottleneck | Optimize configuration |
| Cost too high | Downgrade/optimize |

### Cost Prediction

| Dimension | Prediction Elements |
|-----------|-------------------|
| LLM cost | Token consumption × unit price |
| Compute cost | Instances × unit price × duration |
| Storage cost | Storage volume × unit price |
| Network cost | Traffic × unit price |

### Capacity Planning Reports

- Weekly capacity report
- Scaling recommendations
- Cost prediction
- Risk warnings

## Consequences

Advantages:

- Forward-looking planning avoids emergency scaling
- Cost prediction supports budget setting
- Optimization recommendations reduce cost

Trade-offs:

- Prediction models require data accumulation
- Prediction accuracy depends on model quality

## Cross References

- [ADR-024 Scalability Architecture](./024-scalability-architecture.md)
- [ADR-064 Cost Attribution and Optimization Engine](./064-cost-attribution-and-optimization-engine.md)

## Source Section

- `§67` Capacity Planning and Cost Prediction Engine