# Multi Region Replication Contract

## 1. Scope

Defines the topology and failure behavior of multi-region truth/event/artifact replication.

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

- Write paths must declare whether they are synchronous quorum or asynchronous eventual consistent.
- When failover occurs, the switching epoch and incomplete replication window must be recorded.
- Residency-restricted data must not be replicated to unauthorized regions.