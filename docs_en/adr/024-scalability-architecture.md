# ADR-024 Scalability Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform needs to support smooth scaling from single-machine to cluster while maintaining data consistency and performance. Different scale stages require different architectural strategies.

## Decision

### Tiered Scaling Strategy

| Stage | Architecture | Concurrency | Storage | Workers |
|-------|-------------|-------------|---------|---------|
| S1 | Single machine | ≤10 | SQLite | 5 |
| S2 | Multi-process | 10-100 | SQLite + Redis | 20 |
| S3 | Distributed | 100-1000 | PostgreSQL | 100 |
| S4 | K8s cluster | 5000+ | PG sharded | 500+ |

### Queue Sharding Strategy

- Dispatch queue shards by tenant_id hash
- Ensures tenant isolation

### HorizontalScalingController

- `shared/scaling/` implements horizontal scaling controller
- Supports load-based auto scaling

### S3 Special Notes

- Uses PostgreSQL + SQLite dual running mode
- SQLite as local cache
- PG as primary storage
- No async mirroring (synchronous replication)

## Consequences

Benefits:

- Tiered scaling strategy matches different business stages
- Queue sharding prevents single-tenant blocking
- Horizontal scaling controller supports auto scaling

Trade-offs:

- Multi-stage architecture increases operational complexity
- S3/S4 requires more infrastructure investment

## Cross-references

- [ADR-012 SQLite as Phase 1-2 Only Primary Storage](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-031 Disaster Recovery and High Availability Architecture](./031-disaster-recovery-and-high-availability.md)

## Source Section

- `§8` Scalability Architecture
