# ADR-028 Incident and Event Handling Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform generates large volumes of events and alerts during runtime, requiring unified event classification, severity levels, detection rules, and alert routing mechanisms.

## Decision

### E1-E6 Event Classification

| Type | Description |
|------|-------------|
| E1 | System-level failures |
| E2 | Application-level exceptions |
| E3 | Business-level events |
| E4 | Security events |
| E5 | Performance events |
| E6 | Change events |

### SEV1-SEV4 Severity Levels

| Level | Description | SLA Response Time |
|-------|-------------|-------------------|
| SEV1 | Platform unavailable | 15 minutes |
| SEV2 | Core functionality impaired | 30 minutes |
| SEV3 | Non-core functionality abnormal | 2 hours |
| SEV4 | Minor issues | 24 hours |

### DetectionRule Interface

```typescript
interface DetectionRule {
  rule_id: string;
  name: string;
  condition: string;
  severity: SEVLevel;
  action: AlertAction;
}
```

### 5 Built-in Detection Rules

1. Heartbeat missing detection
2. Timeout spike detection
3. Projection delay detection
4. Security violation detection
5. Full platform failure detection

### 10 Core Metrics

- Collected via OTel integration
- Support Prometheus export

### StructuredLog Interface

```typescript
interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  trace_id: string;
  metadata: Record<string, unknown>;
}
```

### Trace Span Hierarchy

- OTel SDK implements distributed tracing
- Span hierarchy: service → operation → step

## Consequences

Positive:
- Unified event classification facilitates analysis and response
- Tiered alerts ensure critical issues are prioritized
- StructuredLog facilitates log retrieval and analysis

Negative:
- Event collection adds system overhead
- Requires supporting alert routing system

Trade-offs:
- Visibility vs. overhead
- Comprehensiveness vs. complexity

## Cross-References

- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-025 Stability Architecture Seven Layers](./025-stability-architecture-seven-layers.md)

## Source Sections

- `§12` Anomaly Events and Observability