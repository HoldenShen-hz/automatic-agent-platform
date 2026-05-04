# ADR-054 SLA Tiered Guarantees

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Different businesses have different SLA requirements, and the platform needs to support tiered SLA guarantees.

## Decision

### SLA Tiers

| Tier | Name | Availability | Response Time | Concurrency |
|------|------|--------------|---------------|-------------|
| platinum | Platinum | 99.99% (requires multi-region HA deployment) | < 100ms | 1000+ |
| gold | Gold | 99.9% | < 500ms | 500 |
| silver | Silver | 99.5% | < 1s | 100 |
| bronze | Bronze | 99% | < 5s | 50 |

**Note**: Platinum 99.99% availability requires multi-region HA deployment, automatic failover, and separate SLA contract terms. "No preconditions" 99.99% is not achievable for single-region deployments.

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
- SLA violation alerts
- SLA report generation

### SLA Compensation

| Violation Type | Compensation Method |
|----------------|--------------|
| Availability below target | Service extension |
| Latency exceeded | Partial refund |
| Error rate exceeded | Credit compensation |

## Consequences

Advantages:

- Tiered services meet different business needs
- SLA compensation enhances user trust
- Monitoring metrics facilitate problem identification

Costs:

- Multi-tier SLA increases operational complexity
- Compensation calculation requires precision

## Cross-References

- [ADR-053 Scaling Resource Competition Management](./053-scaling-resource-competition-management.md)
- [Platform Architecture §27 Performance Architecture and SLO](../architecture/00-platform-architecture.md)

## Source Section

- `§54` SLA Tiered Guaranteescompetition-management.md)
- [Platform Architecture §27 Performance Architecture and SLO](../architecture/00-platform-architecture.md)

## Source Sections

- `§54` SLA Tiered Guarantees