# ADR-043 Unified Operations Dashboard

- Status：Accepted
- Decision Date：2026-04-20

## Background

Operations personnel need a unified view to understand the overall platform status rather than being scattered across multiple monitoring systems.

## Decision

### Dashboard Architecture

| Module | Description |
|------|------|
| System Overview | Platform overall health status |
| Task Board | Real-time task status and progress |
| Event Center | Alert and event lists |
| Cost Report | Resource consumption and cost |
| Performance Monitoring | P99/latency/error rate |
| Security Posture | Authentication/authorization/audit |

### WebSocket Real-time Push

- `/ws/v1/stream` endpoint
- DashboardWebSocketServer implementation
- Real-time status updates

### View Layering

| Layer | Audience | Content |
|------|------|------|
| Management layer | Executives | Business metrics, health status |
| Operations layer | SRE | System metrics, alerts, capacity |
| Development layer | Developers | Task details, logs, traces |

### Alert Aggregation

- Reduce alert fatigue
- Intelligent grouping
- Root cause analysis assistance

## Consequences

Advantages:

- Unified view improves operational efficiency
- Real-time push ensures timely response
- Layered views satisfy different audiences

Costs:

- Dashboard maintenance costs
- Real-time data pipeline complexity

## Cross-references

- [ADR-028 Incident and Event Handling Architecture](./028-incident-and-event-handling-architecture.md)
- [ADR-084 Operator Dashboard and Non-technical User Experience](./084-operator-dashboard-and-user-experience.md)

## Source Section

- `§43` Unified Operations Dashboard Architecture