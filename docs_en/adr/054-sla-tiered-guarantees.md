# ADR-054 SLA Tiered Guarantees

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Different businesses have different SLA requirements, and the platform needs to support tiered SLA guarantees.

## Decision

### SLA Tiers

| Tier | Name | Availability | Response Time | Concurrency | Prerequisites |
|------|------|-------------|---------------|--------------|---------------|
| platinum | Platinum | 99.95% | < 100ms | 1000+ | Required: Auto failover + quorum + capacity reservation + drill evidence |
| gold | Gold | 99.9% | < 500ms | 500 | - |
| silver | Silver | 99.5% | < 1s | 100 | - |
| bronze | Bronze | 99% | < 5s | 50 | - |

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

- Real-time SLA metrics collection
- SLA violation early warning
- SLA report generation

### SLA Compensation

| Violation Type | Compensation Method |
|----------------|---------------------|
| Availability not met | Service extension |
| Latency exceeded | Partial refund |
| Error rate exceeded | Credit compensation |

All SLA commitments must be traceable to `HarnessRun / NodeRun / NodeAttemptReceipt` evidence.

Supplementary notes:

- `99.99%` is only allowed to be separately committed in dedicated deployments or exclusive contracts, and should not be written as platform default platinum tier in general ADRs.

## Consequences

Pros:

- Tiered service meets different business needs
- SLA compensation enhances user trust
- Monitoring metrics facilitate problem identification

Cons:

- Multi-level SLA increases operations complexity
- Compensation calculation requires precision

## Cross References

- [ADR-053 Scaling Resource Competition Management](./053-scaling-resource-competition-management.md)
- [Platform Architecture §27 Performance Architecture and SLO](../architecture/00-platform-architecture.md)

## Source Sections

- `§54` SLA Tiered Guarantees