# ADR-043 Unified Operations Dashboard

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Operators need a unified dashboard to monitor platform health, view task status, and manage incidents. The dashboard must aggregate data from multiple planes.

## Decision

### Dashboard Architecture

```
src/interaction/dashboard/
```

### L1-L4 DTO Aggregation

| Layer | Description |
|-------|-------------|
| L1 | Raw metrics and events |
| L2 | Aggregated indicators |
| L3 | Trend analysis |
| L4 | Predictive insights |

### Core Metrics

| Metric | Description |
|--------|-------------|
| Task Success Rate | Percentage of successfully completed tasks |
| Average Execution Time | Mean task execution duration |
| Active Workers | Current number of active workers |
| Queue Depth | Number of pending tasks |
| Error Rate | Percentage of failed tasks |

### Real-Time Updates

- WebSocket /ws/v1/stream
- Server-Sent Events support
- Polling fallback for legacy clients

### Dashboard Components

| Component | Description |
|-----------|-------------|
| TaskMonitor | Real-time task status monitoring |
| WorkerPoolView | Worker allocation and health |
| IncidentPanel | Active incident management |
| MetricChart | Time-series visualization |
| AlertFeed | Live alert notifications |

## Consequences

Positive:
- Unified view improves operational efficiency
- Real-time updates enable quick response
- L1-L4 aggregation provides comprehensive insights

Negative:
- Dashboard complexity increases with more metrics
- Real-time updates require robust infrastructure

Trade-offs:
- Visibility vs. complexity
- Real-time vs. resource cost

## Cross-References

- [ADR-041 Proactive Agent Framework](./041-proactive-agent-framework.md)
- [ADR-084 Operator Dashboard and User Experience](./084-operator-dashboard-and-user-experience.md)

## Source Sections

- `§43` Unified Operations Dashboard