# ADR-052 Multi-Region Deployment Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Enterprise operations span multiple geographic regions, requiring multi-region deployment to ensure low latency and high availability.

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

### Data Synchronization

| Sync Mode | Description | RPO |
|-----------|-------------|-----|
| async | Asynchronous replication | < 1s |
| eventual | Eventual consistency | < 1min |

Constraints:

- v4.2/v4.3 does not support multi-master truth writes, nor does it support cross-region `sync` replication with `RPO = 0`.
- `HarnessRun / NodeRun / BudgetLedger` truth must remain single-writer; cross-region replication is only permitted for append-only evidence, read models, or async shadow data.
- Automatic failover must be based on async replication, lease takeover, and fencing validation, not assuming multi-master synchronous truth writes.

### Failover

- Automatic detection of region failures
- Automatic traffic switching to backup region
- Data synchronization after failed region is repaired

## Consequences

Advantages:

- Geographic proximity access reduces latency
- Region-level failures do not affect the global system
- Compliance requirements (data residency) are met

Costs:

- Multi-region operational complexity
- Cross-region data consistency challenges

## Cross References

- [ADR-031 Disaster Recovery and High Availability Architecture](./031-disaster-recovery-and-high-availability.md)
- [ADR-053 Scaling Resource Competition Management](./053-scaling-resource-competition-management.md)

## Source Section

- `§52` Multi-Region Deployment Architecture

## v4.3 ADR Remediation

- A-24: This ADR originally listed `sync` replication and stated `RPO=0`. The root cause was that the multi-region ADR reused traditional database deployment terminology without distinguishing between append-only evidence replication and runtime truth single-writer boundaries. Fix: The main text now explicitly states that v4.2/v4.3 only acknowledges async/eventual replication, and does not support multi-master truth writes or `RPO=0` sync replication.
