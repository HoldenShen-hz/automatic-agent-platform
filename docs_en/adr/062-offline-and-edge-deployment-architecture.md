# ADR-062 Offline and Edge Deployment Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Edge scenarios such as factories, retail stores, and mobile devices cannot access the cloud and require offline deployment support.

## Decision

### Deployment Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| cloud | Full cloud deployment | Data center |
| hybrid | Cloud + edge collaboration | Branch offices |
| edge | Pure edge deployment | Factory/store |
| mobile | Mobile devices | Field operations |

### Edge Runtime

```typescript
interface EdgeRuntime {
  runtime_id: string;
  mode: EdgeMode;
  local_capabilities: LocalCapability;
  sync_config: SyncConfig;
  offline_queue: OfflineOperation[];
}
```

### Data Synchronization Strategies

| Sync Mode | Description | Network Requirements |
|-----------|-------------|----------------------|
| realtime | Real-time sync | Stable connection |
| batch | Batch sync | Intermittent connection |
| delay_tolerant | Delay tolerant | Low bandwidth |
| store_forward | Store and forward | Fully offline |

### Edge Capabilities

- Local task execution
- Local knowledge base
- Local state cache
- Offline task queue

### Conflict Resolution

| Strategy | Description |
|----------|-------------|
| last_write_wins | Last write wins |
| server_wins | Server wins |
| merge | Merge conflicts |
| manual | Manual resolution |

## Consequences

Advantages:

- Supports offline scenarios
- Reduces network dependency
- Expands scope of applicability

Trade-offs:

- Synchronization complexity
- Conflict handling complexity

## Cross References

- [ADR-052 Multi-Region Deployment Architecture](./052-multi-region-deployment-architecture.md)
- [ADR-031 Disaster Recovery and High Availability Architecture](./031-disaster-recovery-and-high-availability.md)

## Source Section

- `§62` Offline and Edge Deployment Architecture

## v4.3 ADR Remediation

- R3-60: This ADR defines `last_write_wins` as one of the conflict resolution strategies, which does not contradict the truth data requirements in §25.11. The root cause is that offline data synchronization in edge deployment scenarios (factories, stores, etc.) has different constraints from centralized truth data systems. Fix: The main text explicitly states that `last_write_wins` applies only to edge temporary data synchronization scenarios and does not apply to core state data that requires truth consistency; the latter must use `server_wins` or `merge` strategies.
