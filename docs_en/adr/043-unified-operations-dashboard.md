# ADR-043 Unified Operations Dashboard

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Operations personnel need a unified view to understand the overall platform status, rather than scattered across multiple monitoring systems.

## Decision

### Dashboard Architecture

| Module | Description |
|--------|-------------|
| System Overview | Platform overall health status |
| Task Board | Real-time task status and progress |
| Event Center | Alerts and event list |
| Cost Report | Resource consumption and cost |
| Performance Monitoring | P99/latency/error rate |
| Security Posture | Authentication/authorization/audit |

### WebSocket Real-time Push

- `/ws/v1/stream` endpoint
- DashboardWebSocketServer implementation
- Real-time status updates

### View Tiering

| Tier | Audience | Content |
|------|----------|---------|
| Management | Executives | Business metrics, health status |
| Operations | SRE | System metrics, alerts, capacity |
| Development | Engineers | Task details, logs, traces |

### Alert Aggregation

- Reduce alert fatigue
- Intelligent grouping
- Root cause analysis assistance

## Consequences

Advantages:

- Unified view improves operations efficiency
- Real-time push ensures timely response
- Tiered view meets different audiences

Trade-offs:

- Dashboard maintenance cost
- Real-time data pipeline complexity

## Cross References

- [ADR-028 Incident and Event Handling Architecture](./028-incident-and-event-handling-architecture.md)
- [ADR-084 Operator Dashboard and Non-technical User Experience](./084-operator-dashboard-and-user-experience.md)

## Source Section

- `§43` Unified Operations Dashboard Architecture