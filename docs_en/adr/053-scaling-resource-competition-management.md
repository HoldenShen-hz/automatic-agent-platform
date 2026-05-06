# ADR-053 Scaling Resource Competition Management

- Status: Accepted
- Decision Date: 2026-04-20

## Context

When multiple business lines run concurrently, resource competition occurs. A fair and effective resource allocation mechanism is needed.

## Decision

### Resource Pool Model

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
}
```

Note: ResourcePool / ResourceAllocation (reserved/used) integrates with §1.5 frozen BudgetLedger / BudgetReservation / BudgetSettlement — ResourcePool is responsible for runtime compute resource quotas, BudgetLedger is responsible for financial budget settlement. The two are linked via `tenant_id`, with BudgetSettlement as the sole settlement exit. ResourcePool must not land quotas alone (must be validated via BudgetLedger). The original parallel model (each landing independently) has been abolished.

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

- Platform-level quotas
- Tenant-level quotas
- Business domain-level quotas
- Dynamic adjustment

## Consequences

Pros:

- Fair resource allocation prevents starvation
- Priority mechanism guarantees critical business
- Dynamic adjustment adapts to load changes

Cons:

- Scheduling algorithm complexity
- Quota calculation overhead

## Cross-references

- [ADR-024 Scalability Architecture](./024-scalability-architecture.md)
- [ADR-054 SLA Tiered Guarantees](./054-sla-tiered-guarantees.md)

## Source Section

- `§53` Scaling Resource Competition Management
