# ADR-054 SLA Tiered Guarantees

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Different customers have different SLA requirements based on their business criticality, and the platform must guarantee committed service levels.

## Decision

### SLATier Levels

| Tier | Name | Availability | Max Latency | Support |
|------|------|--------------|-------------|---------|
| Basic | Basic | 99.0% | 5000ms | Community |
| Standard | Standard | 99.5% | 2000ms | Email |
| Premium | Premium | 99.9% | 500ms | 24/7 Phone |
| Enterprise | Enterprise | 99.99% | 100ms | Dedicated |

### SLA Metrics

```typescript
interface SLAMetrics {
  availability: number;        // Percentage uptime
  latency_p99: number;         // P99 latency in ms
  error_rate: number;          // Percentage of failed requests
  throughput: number;          // Requests per second
}
```

### SLA Monitoring

- `scale-ecosystem/sla-engine/sla-operations-service.ts`
- Real-time SLA metric collection
- Breach alerts and automatic remediation
- SLA credit compensation for breaches

### SLA Breach Handling

| Breach Type | Automatic Action |
|-------------|------------------|
| Availability < 99.9% | Create incident, notify SRE |
| Latency > threshold | Auto-scaling trigger |
| Error rate > 1% | Circuit breaker activation |

## Consequences

Positive:
- Differentiated service levels match business needs
- Automatic remediation maintains SLA
- SLA credits ensure accountability

Negative:
- SLA guarantees increase operational complexity
- Compensation tracking overhead

Trade-offs:
- Premium vs. cost
- Guarantees vs. flexibility

## Cross-References

- [ADR-024 Scalability Architecture](./024-scalability-architecture.md)
- [ADR-052 Multi-Region Deployment](./052-multi-region-deployment-architecture.md)

## Source Sections

- `§54` SLA Tier Guarantee