# ADR-043 Unified Operations Dashboard

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Operations personnel need a unified view to understand the overall platform status, rather than being scattered across multiple monitoring systems.

## Decision

### Dashboard Architecture

| Module | Description |
|--------|-------------|
| System Overview | Overall platform health status |
| Task Board | Real-time task status and progress |
| Event Center | Alerts and event lists |
| Cost Report | Resource consumption and costs |
| Performance Monitoring | P99/latency/error rate |
| Security Posture | Authentication/authorization/audit |

### WebSocket Real-time Push

- `/ws/v1/stream` endpoint
- DashboardWebSocketServer implementation
- Real-time status updates

### View Layers

| Layer | Audience | Content |
|-------|----------|---------|
| Management Layer | Executives | Business metrics, health status |
| Operations Layer | SRE | System metrics, alerts, capacity |
| Development Layer | Developers | Task details, logs, trace |

### Alert Aggregation

- Reduce alert fatigue
- Intelligent grouping
- Root cause analysis assistance

## Consequences

Positive:

- Unified view improves operational efficiency
- Real-time push ensures timely response
- Layered views serve different audiences

Negative:

- Dashboard maintenance costs
- Real-time data pipeline complexity

## Cross-References

- [ADR-028 Incident and Event Handling Architecture](./028-incident-and-event-handling-architecture.md)
- [ADR-084 Operator Dashboard and User Experience](./084-operator-dashboard-and-user-experience.md)

## Source Sections

- `§43` Unified Operations Dashboard Architecture
