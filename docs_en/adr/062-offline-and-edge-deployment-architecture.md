# ADR-062 Offline and Edge Deployment Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Edge scenarios like factories, stores, and mobile devices cannot access cloud, need to support offline deployment.

## Decision

### Deployment Modes

| Mode | Description | Applicable Scenario |
|------|-------------|-------------------|
| cloud | Cloud full deployment | Data center |
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
|-----------|-------------|-------------------|
| realtime | Real-time sync | Stable connection |
| batch | Batch sync | Intermittent connection |
| delay_tolerant | Delay tolerant | Low bandwidth |
| store_forward | Store and forward | Completely offline |

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
| merge | Only for projection / non-critical statistical object merge conflicts |
| manual | Manual resolution |

## Consequences

Advantages:

- Supports offline scenarios
- Reduces network dependency
- Expands applicable scope

Trade-offs:

- Sync complexity
- Conflict resolution complexity

## Cross References

- [ADR-052 Multi-Region Deployment Architecture](./052-multi-region-deployment-architecture.md)
- [ADR-031 Disaster Recovery and High Availability Architecture](./031-disaster-recovery-and-high-availability.md)

## Source Section

- `§62` Offline and Edge Deployment Architecture

## v4.3 ADR Remediation

- R3-60: This ADR defines `last_write_wins` as one of conflict resolution strategies, not conflicting with §25.11 truth data requirements. Root cause being offline data sync in edge deployment scenarios (factory, store, etc.) has different constraints from centralized truth data system. Fix: Body explicitly states `last_write_wins` only applies to edge temporary data sync scenarios, not applicable to core state data requiring truth consistency; the latter must use `server_wins` or `merge` strategy.
- `merge` similarly only allowed for projection / cache / non-authoritative statistical objects; `truth / budget / side effect` must still go through centralized authoritative writer with fencing protection.