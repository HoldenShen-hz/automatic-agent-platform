# ADR-031 Disaster Recovery and High Availability Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Enterprise platforms must have disaster recovery capabilities to ensure rapid service restoration during data center failures. RTO and RPO are key metrics.

## Decision

### HA-1 Objectives

| Metric | Target Value |
|--------|--------------|
| RTO (Recovery Time Objective) | < 1 hour |
| RPO (Recovery Point Objective) | < 15 minutes |
| Backup Retention Period | 90 days |
| Drill Frequency | Monthly (15th of each month at 3am) |

### Backup Strategy

- Automatic daily backup at 2am
- Backups stored in isolated storage area
- Supports full backup and incremental backup

### DR Drills

- `deploy/scripts/dr-drill.sh` (568 lines) implements DR drill script
- Includes fault injection and recovery verification

### High Availability Design

- No single point of failure
- Critical services deployed with multiple instances
- Automatic failover

## Consequences

Pros:

- Clear RTO/RPO targets guide architecture decisions
- Regular drills ensure recovery capability is available
- Backup retention policy meets compliance requirements

Cons:

- Backup storage costs
- Drills consume production resources

## Cross-references

- [ADR-024 Scalability Architecture](./024-scalability-architecture.md)
- [ADR-032 Deployment Architecture](./032-deployment-architecture.md)

## Source Section

- `§31` Disaster Recovery and High Availability Architecture
