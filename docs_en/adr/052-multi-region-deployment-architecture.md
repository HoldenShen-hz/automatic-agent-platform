# ADR-052 Multi-Region Deployment Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Enterprises operating across regions need multi-region deployment to ensure low latency and high availability.

## Decision

### Multi-Region Model

```typescript
interface Region {
  region_id: string;
  name: string;
  location: GeoLocation;
  role: RegionRole;
  endpoints: RegionEndpoints;
}

type RegionRole = 'primary' | 'replica' | 'hot_standby';
```

### Traffic Routing

| Strategy | Description |
|----------|-------------|
| latency_based | Latency-based routing |
| geo_based | Geographic-based routing |
| load_balanced | Load balancing |
| failover | Failover |

### Data Sync

| Sync Mode | Description | RPO |
|-----------|-------------|-----|
| async | Asynchronous replication | < 1s |
| eventual | Eventually consistent | < 1min |

Constraints:

- v4.2/v4.3 does not commit to multi-primary truth writes, nor to cross-region `sync` replication with `RPO = 0`.
- `HarnessRun / NodeRun / BudgetLedger` truth must remain single-writer; cross-region replication only allows append-only evidence, read models, or async shadow data.
- Automatic failover must be built on async replication, lease takeover, and fencing validation, not assuming multi-primary sync truth writes.

### Failover

- Automatic detection of Region failures
- Automatic traffic switching to standby Region
- Data sync after failed Region is repaired

## Consequences

Pros:

- Geographic proximity access reduces latency
- Region-level failures do not affect the whole
- Compliance requirements (data residency) are met

Cons:

- Multi-region operational complexity
- Cross-region data consistency challenges

## Cross References

- [ADR-031 Disaster Recovery and High Availability Architecture](./031-disaster-recovery-and-high-availability.md)
- [ADR-053 Scaling Resource Competition Management](./053-scaling-resource-competition-management.md)

## Source Section

- `§52` Multi-Region Deployment Architecture

## v4.3 ADR Remediation

- A-24: This ADR originally listed `sync` replication and gave `RPO=0`. The root cause is that the multi-region ADR reused traditional database deployment language without distinguishing append-only evidence replication from runtime truth single-writer boundaries. Fix: The body now explicitly states that v4.2/v4.3 only acknowledges async/eventual replication, and does not commit to multi-primary truth writes or `RPO=0` sync replication.