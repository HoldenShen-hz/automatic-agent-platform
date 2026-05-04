# ADR-062 Offline and Edge Deployment Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Edge scenarios such as factories, stores, and mobile devices cannot access the cloud, requiring offline deployment support.

## Decision

### Deployment Modes

| Mode | Description | Use Cases |
|------|-------------|-----------|
| cloud | Full cloud deployment | Data centers |
| hybrid | Cloud + edge coordination | Branch offices |
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

### Data Sync Strategies

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

| Strategy | Scope | Description |
|----------|-------|-------------|
| `server_wins` | truth / budget / side effect objects | Server single leader write (required); complies with §25.11/§52.3 fencing requirements |
| `last_write_wins` | projection / non-critical statistical objects | Client timestamp priority write (allowed for projections only, NOT for truth objects) |
| `merge` | projection / non-critical statistical objects | Merge conflicts (can use CRDT) |
| `manual` | all objects | Manual resolution |

**Constraints**:
- truth / budget / side effect objects must use `server_wins` (single leader write + fencing); `last_write_wins` is NOT allowed for truth/budget/side-effect objects, even if they are in offline scenarios
- projection / non-critical statistical objects may use `last_write_wins` or `merge`
- §25.11/§52.3 requires that single leader write does not use fencing token protection
- `server_wins` is the ONLY acceptable strategy for truth and budget objects, including in edge/offline deployments

## Consequences

Positive:

- Supports offline scenarios
- Reduces network dependency
- Expands applicable scope

Negative:

- Sync complexity
- Conflict resolution complexity

## Cross-References

- [ADR-052 Multi-Region Deployment Architecture](./052-multi-region-deployment-architecture.md)
- [ADR-031 Disaster Recovery and High Availability](./031-disaster-recovery-and-high-availability.md)

## Source Sections

- `§62` Offline and Edge Deployment Architecture