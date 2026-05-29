# ADR-028 Incident and Event Handling Architecture

- Status：Accepted
- Decision Date：2026-04-03

## Background

The platform runtime generates a large number of events and alerts, requiring unified event classification, severity levels, detection rules, and alert routing mechanisms.

## Decision

### E1-E6 Event Classification

| Type | Description |
|------|------|
| E1 | System-level failure |
| E2 | Application-level exception |
| E3 | Business-level event |
| E4 | Security event |
| E5 | Performance event |
| E6 | Change event |

### SEV1-SEV4 Severity Levels

| Level | Description | SLA Response Time |
|------|------|-------------|
| SEV1 | Platform unavailable | 15 minutes |
| SEV2 | Core functionality impaired | 30 minutes |
| SEV3 | Non-core functionality abnormal | 2 hours |
| SEV4 | Minor issue | 24 hours |

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

1. Heartbeat absence detection
2. Timeout surge detection
3. Projection delay detection
4. Security violation detection
5. Full platform failure detection

### 10 Core Metrics

- Collected via OTel integration
- Supports Prometheus export

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

### Trace Span Hierarchy（Fixing step deprecated issue）

> Note: R5-64 Fix - `step` terminology has been deprecated in v4.3, please use `node_run`/`node_attempt` instead.

- Span semantics should be organized by `service -> operation -> node_run -> node_attempt`, old `step` terminology is only allowed in compatibility projection views.

- OTel SDK implements distributed tracing
- Span hierarchy: service → operation → node_run → node_attempt (deprecated `step`)

## Consequences

Advantages:

- Unified event classification facilitates analysis and response
- Tiered alerting ensures critical issues are handled first
- StructuredLog facilitates log search and analysis

Costs:

- Event collection adds system overhead
- Requires supporting alert routing system

## Cross-references

- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-025 Stability Architecture](./025-stability-architecture-seven-layers.md)

## Source Section

- `§12` Incident and Event Handling Architecture