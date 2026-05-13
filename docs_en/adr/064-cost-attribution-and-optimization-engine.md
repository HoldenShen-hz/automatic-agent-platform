# ADR-064 Cost Attribution and Optimization Engine

- Status: Accepted
- Decision Date: 2026-04-20

## Context

LLM cost is the main component of OPEX, requiring precise cost attribution and optimization guidance.

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
  harness_run_id?: string;
  node_run_id?: string;
  budget_settlement_ref?: string;
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
| batch_processing | Batch request merging | 20-30% |

### Budget Control

- 4-level budget: platform/tenant/harness_run/node_run
- Real-time budget monitoring
- Budget overrun alerts
- Automatic degradation

### Cost Reports

- Real-time cost dashboard
- Historical trend analysis
- Budget execution report
- Optimization effect tracking

## Consequences

Advantages:

- Precise attribution guides optimization
- Budget control prevents overruns
- Reports facilitate management decisions

Costs:

- Metering increases overhead
- Optimization recommendations

## v4.3 ADR Remediation

- A-23: This ADR originally continued using `workflow_id / step_id` for cost dimensions, root cause being the cost engine ADR followed the linear workflow granularity, not migrating with v4.3 execution truth objects to `HarnessRun / NodeRun / BudgetSettlement`. Fix: The main text now converges `CostDimension` to `harness_run_id / node_run_id / budget_settlement_ref`.