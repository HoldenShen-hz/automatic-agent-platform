# ADR-053 Scaling Resource Competition Management

- Status: Accepted
- Decision Date: 2026-04-20

## Background

When multiple business lines run concurrently, resource competition arises, requiring fair and effective resource allocation mechanisms.

## Decision

### Resource Pool Model

ResourcePool/ResourceAllocation is deeply integrated with BudgetLedger/BudgetReservation to uniformly manage resource allocation and budget deduction; together they constitute the atomic unit of resource allocation:

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
  budgetLedgerEntry: string;  // Reference to BudgetLedger record
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
| fifo | First come first served |
| weighted_fair | Weighted fair queue |

### Resource Quotas

- Platform-level quotas
- Tenant-level quotas
- Business domain-level quotas
- Dynamic adjustment

## Consequences

Advantages:

- Fair resource allocation prevents starvation
- Priority mechanism guarantees critical business
- Dynamic adjustment adapts to load changes

Trade-offs:

- Scheduling algorithm complexity
- Quota calculation overhead

## Cross References

- [ADR-024 Scalability Architecture](./024-scalability-architecture.md)
- [ADR-054 SLA Tiered Guarantees](./054-sla-tiered-guarantees.md)

## Source Section

- `§53` Scaling Resource Competition Management