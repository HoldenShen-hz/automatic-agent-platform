# ADR-062 Offline and Edge Deployment Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Edge scenarios such as factories, stores, and mobile devices cannot access the cloud, requiring offline deployment support.

## Decision

### Deployment Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| cloud | Full cloud deployment | Data center |
| hybrid | Cloud + edge collaboration | Branch offices |
| edge | Pure edge deployment | Factory/store |
| mobile | Mobile device | On-site operations |

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

### Data Sync Strategies

| Sync Mode | Description | Network Requirements |
|----------|-------------|---------------------|
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
| server_wins | Server priority |
| merge | Merge conflicts |
| manual | Manual resolution |

## Consequences

Advantages:

- Supports offline scenarios
- Reduces network dependency
- Expands applicable scope

Costs:

- Sync complexity
- Conflict handling complexity

## Cross References

- [ADR-052 Multi-Region Deployment Architecture](./052-multi-region-deployment-architecture.md)
- [ADR-031 Disaster Recovery and High Availability Architecture](./031-disaster-recovery-and-high-availability.md)

## Source Section

- `§62` Offline and Edge Deployment Architecture

## v4.3 ADR Remediation

- R3-60: This ADR defines `last_write_wins` as one of the conflict resolution strategies, which does not conflict with §25.11 truth data requirements. Root cause is that edge deployment scenarios (factories, stores, etc.) have different constraints for offline data sync versus centralized truth data systems. Fix: The main text now clarifies that `last_write_wins` applies only to edge temporary data sync scenarios, not to core state data requiring truth consistency; the latter must use `server_wins` or `merge` strategies.