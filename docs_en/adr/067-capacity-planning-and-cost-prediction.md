# ADR-067 Capacity Planning and Cost Prediction Engine

- Status: Accepted
- Decision Date: 2026-04-20

## Context

The platform needs to predict capacity requirements and cost trends, supporting proactive scaling decisions.

## Ring Annotation

**Ring 3 — Enterprise** (§33). Capacity planning and cost prediction is a core capability for scaled operations, corresponding to Ring 3 (Enterprise) completion stage. Ring 1 MVP stage does not require a complete capacity prediction engine, but must reserve capacity data collection interfaces to avoid missing telemetry in future expansion.

## Decision

### Capacity Metrics

| Metric | Description | Collection Frequency |
|--------|-------------|----------------------|
| cpu_usage | CPU utilization | 1 minute |
| memory_usage | Memory utilization | 1 minute |
| queue_depth | Queue depth | 1 minute |
| active_tasks | Active task count | 1 minute |
| throughput | Throughput | 5 minutes |

### Prediction Model

```typescript
interface CapacityForecast {
  horizon: TimeHorizon;
  predictions: MetricPrediction[];
  confidence: number;
  recommendations: Recommendation[];
}

interface MetricPrediction {
  metric: string;
  values: TimeSeriesPoint[];
  trend: Trend;
  seasonality: Seasonality;
}
```

### Prediction Algorithms

| Algorithm | Use Cases |
|-----------|-----------|
| ARIMA | Trend prediction |
| Holt-Winters | Seasonal prediction |
| Prophet | Multiple seasonality |
| LSTM | Complex patterns |

### Scaling Recommendations

| Scenario | Recommendation |
|----------|----------------|
| Capacity insufficient | Add Workers |
| Resource waste | Reduce resources |
| Performance bottleneck | Optimize configuration |
| Cost too high | Downgrade/optimize |

### Cost Prediction

| Dimension | Prediction Factors |
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

Positive:

- Proactive planning avoids emergency scaling
- Cost prediction supports budget planning
- Optimization recommendations reduce cost

Negative:

- Prediction models require data accumulation
- Prediction accuracy depends on model quality

## Cross-References

- [ADR-024 Scalability Architecture](./024-scalability-architecture.md)
- [ADR-064 Cost Attribution and Optimization Engine](./064-cost-attribution-and-optimization-engine.md)

## Source Section

- `§67` Capacity Planning and Cost Prediction Engine
