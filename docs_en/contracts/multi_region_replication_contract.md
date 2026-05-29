# Multi Region Replication Contract

## 1. 范围

defines多区域 truth/event/artifact 复制的拓扑vsfailedlines为。

## 2. 核心对象

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

## 3. 约束

- 写路径必须声明issynchronous仲裁还is异步最终一致。
- 发生 failover 时必须record切换 epoch vs未完成复制窗口。
- 驻留受限data不得复制到未authorization区域。

