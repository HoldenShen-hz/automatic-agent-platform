# Multi Region Replication Contract

## 1. Scope

Defines topology and failure behavior for multi-region truth/event/artifact replication.

## 2. Core Objects

```typescript
interface MultiRegionReplicationPolicy {
  policyId: string;
  primaryRegion: string;
  replicaRegions: string[];
  replicationMode: "sync_quorum" | "async_eventual";
  maxLagSeconds: number;
  failoverMode: "manual" | "guarded_auto";
}
```

## 3. Constraints

- Write path must declare whether it is synchronous quorum or asynchronous eventual consistency.
- During failover, must record switch epoch and incomplete replication window.
- Data with residency constraints must not be replicated to unauthorized regions.
