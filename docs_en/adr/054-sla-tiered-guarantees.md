# ADR-054 SLA Tiered Guarantees

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Different businesses have different SLA requirements. The platform needs to support SLA tiered guarantees.

## Decision

### SLA Tiers

| Tier | Name | Availability | Response Time | Concurrency |
|------|------|--------------|---------------|-------------|
| platinum | Platinum | 99.95% (99.99% only for dedicated deployment tier) | < 100ms | 1000+ |
| gold | Gold | 99.9% | < 500ms | 500 |
| silver | Silver | 99.5% | < 1s | 100 |
| bronze | Bronze | 99% | < 5s | 50 |

**Note**: `platinum` 99.99% availability can only be externally committed under dedicated deployment tier conditions (automatic failover, quorum, capacity reservation, and complete drill evidence). The platform default SLA upper limit is 99.95%.

### SLA Metrics

```typescript
interface SLARequirement {
  tier: SLATier;
  availability: number;      // Percentage
  latency_p99_ms: number;
  throughput_rpm: number;
  error_rate_max: number;
}
```

### SLA Monitoring

- Real-time SLA metric collection
- SLA violation early warning
- SLA report generation

### SLA Compensation

| Violation Type | Compensation Method |
|----------------|---------------------|
| Availability shortfall | Service extension |
| Latency exceeded | Partial refund |
| Error rate exceeded | Credit compensation |

Prerequisites:

- `platinum` is only allowed to be externally committed when all automatic failover, quorum, capacity reservation, and drill evidence are in place.
- All SLA commitments must be traceable to `HarnessRun / NodeRun / NodeAttemptReceipt` evidence.

## Consequences

Pros:

- Tiered service meets different business needs
- SLA compensation enhances user trust
- Monitoring metrics facilitate problem identification

Cons:

- Multi-tier SLA increases operational complexity
- Compensation calculation requires precision

## Cross-references

- [ADR-053 Scaling Resource Competition Management](./053-scaling-resource-competition-management.md)
- [Platform Architecture §27 Performance Architecture and SLO](../architecture/00-platform-architecture.md)

## Source Section

- `§54` SLA Tiered Guarantees
