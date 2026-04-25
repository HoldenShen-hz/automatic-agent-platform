# ADR-064 Cost Attribution and Optimization Engine

- Status: Accepted
- Decision Date: 2026-04-20

## Context

LLM cost is a major component of OPEX, requiring precise cost attribution and optimization guidance.

## Decision

### Cost Attribution Model

```typescript
interface CostAttribution {
  dimension: CostDimension;
  amount: number;
  currency: string;
  period: TimePeriod;
}

interface CostDimension {
  tenant_id: string;
  domain_id?: string;
  agent_id?: string;
  workflow_id?: string;
  step_id?: string;
  model_id?: string;
}
```

### Cost Types

| Type | Description |
|------|-------------|
| llm_token | LLM Token consumption |
| compute | Compute resources |
| storage | Storage resources |
| network | Network bandwidth |
| api_call | External API |

### Optimization Recommendations

| Recommendation Type | Description | Expected Savings |
|---------------------|-------------|------------------|
| prompt_compression | Reduce Token consumption | 20-40% |
| model_downgrade | Use cheaper model | 30-60% |
| cache_reuse | Cache similar requests | 50-80% |
| batch_processing | Batch request merge | 20-30% |

### Budget Control

- 4-level budget: platform/tenant/pack/step
- Real-time budget monitoring
- Budget overrun alerts
- Automatic degradation

### Cost Reports

- Real-time cost dashboard
- Historical trend analysis
- Budget execution report
- Optimization effectiveness tracking

## Consequences

Positive:

- Precise attribution guides optimization
- Budget control prevents overruns
- Reports facilitate management decisions

Negative:

- Metering adds overhead
- Optimization accuracy depends on data quality

## Cross-References

- [ADR-008 Cost Model](./008-cost-model.md)
- [Platform Architecture §14 Cost Management](../architecture/00-platform-architecture.md)

## Source Sections

- `§64` Cost Attribution and Optimization Engine