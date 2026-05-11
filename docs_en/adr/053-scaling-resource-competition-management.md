# ADR-053 Scaling Resource Competition Management

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Multi-business-line concurrent runtime can lead to resource competition, requiring a fair and effective resource allocation mechanism.

## Decision

### Resource Pool Model

ResourcePool/ResourceAllocation is deeply integrated with BudgetLedger/BudgetReservation to uniformly manage resource allocation and budget billing. Together, these three constitute the atomic unit of resource allocation:

```typescript
interface ResourcePool {
  pool_id: string;
  resource_type: ResourceType;
  capacity: number;
  allocation: ResourceAllocation[];
}

interface ResourceAllocation {
  tenant_id: string;
  reserved: number;
  used: number;
  priority: number;
  budgetLedgerEntry: string;  // References BudgetLedger record
}
```

### Resource Types

| Type | Description |
|------|-------------|
| compute | Compute resources |
| memory | Memory resources |
| storage | Storage resources |
| api_quota | API call quota |
| llm_token | LLM Token quota |

### Scheduling Strategies

| Strategy | Description |
|----------|-------------|
| priority | Priority first |
| fair_share | Fair sharing |
| fifo | First in, first out |
| weighted_fair | Weighted fair queue |

### Resource Quotas

- Platform-level quota
- Tenant-level quota
- Business domain-level quota
- Dynamic adjustment

## Consequences

Advantages:

- Fair resource allocation prevents resource starvation
- Priority mechanism ensures critical business needs are met
- Dynamic adjustment adapts to load changes

Tradeoffs:

- Scheduling algorithm complexity
- Quota calculation overhead

## Cross References

- [ADR-024 Scalability Architecture](./024-scalability-architecture.md)
- [ADR-054 SLA Tiered Guarantees](./054-sla-tiered-guarantees.md)

## Source Section

- `§53` Scaling Resource Competition Management