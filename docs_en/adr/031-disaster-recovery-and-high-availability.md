# ADR-031 Disaster Recovery and High Availability

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Enterprise-class platforms must have disaster recovery capabilities to ensure rapid service restoration when data center failures occur. RTO and RPO are key metrics.

## Decision

### HA-1 Goals

| Metric | Target Value |
|--------|--------------|
| RTO (Recovery Time Objective) | < 1 hour |
| RPO (Recovery Point Objective) | < 15 minutes |
| Backup Retention | 90 days |
| Drill Frequency | Monthly (15th, 3am) |

### Backup Strategy

- Daily 2am automatic backup
- Backup stored in independent storage area
- Supports full and incremental backup

### DR Drill

- `deploy/scripts/dr-drill.sh` (568 lines) implements DR drill script
- Includes fault injection and recovery verification

### High Availability Design

- No single point of failure
- Critical services deployed with multiple instances
- Automatic failover on failure

## Consequences

Benefits:

- Clear RTO/RPO targets guide architectural decisions
- Regular drills ensure recovery capability is available
- Backup retention strategy meets compliance requirements

Trade-offs:

- Backup storage costs
- Drills consume production resources

## Cross-references

- [ADR-024 Scalability Architecture](./024-scalability-architecture.md)
- [ADR-032 Deployment Architecture](./032-deployment-architecture.md)

## Source Section

- `§31` Disaster Recovery and High Availability