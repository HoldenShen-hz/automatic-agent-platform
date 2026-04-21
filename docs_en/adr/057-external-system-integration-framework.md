# ADR-057 External System Integration Framework

- Status: Accepted
- Decision Date: 2026-04-20

## Context

The platform needs to integrate with external systems (CRMs, ERPs, databases) to provide comprehensive automation capabilities.

## Decision

### Connector Framework

```
src/scale-ecosystem/integration/
```

### Connector Types

| Type | Description | Examples |
|------|-------------|----------|
| REST | HTTP-based APIs | REST services |
| GraphQL | GraphQL APIs | GraphQL endpoints |
| Database | SQL/NoSQL connectors | PostgreSQL, MongoDB |
| MessageQueue | Queue systems | RabbitMQ, Kafka |
| FileTransfer | SFTP, blob storage | S3, GCS |

### Connector Lifecycle

| State | Description |
|-------|-------------|
| draft | Connector definition |
| testing | Under integration testing |
| active | Production ready |
| deprecated | Being replaced |
| disabled | No longer available |

### ConnectorRegistry

- `connector-framework-service.ts`
- Version management
- Configuration validation
- Health monitoring

### Integration Patterns

| Pattern | Use Case |
|---------|----------|
| Request-Reply | Synchronous data retrieval |
| Event-Driven | Real-time updates |
| Batch | Bulk data synchronization |
| Polling | Periodic data check |

## Consequences

Positive:
- Extensible framework supports diverse integrations
- Standardized lifecycle ensures quality
- Health monitoring prevents cascading failures

Negative:
- Integration complexity grows with connectors
- Testing all connector combinations is challenging

Trade-offs:
- Flexibility vs. complexity
- Extensibility vs. maintenance

## Cross-References

- [ADR-066 Plugin SPI Framework](./066-plugin-spi-framework.md)
- [ADR-086 Scale Ecosystem and Cross-Region Runtime](./086-scale-ecosystem-and-cross-region-runtime.md)

## Source Sections

- `§57` External System Integration Framework