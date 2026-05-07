# Multi Region Replication Contract

## 1. 范围

定义多区域 truth/event/artifact 复制的拓扑与失败行为。

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

- 写路径必须声明是同步仲裁还是异步最终一致。
- 发生 failover 时必须记录切换 epoch 与未完成复制窗口。
- 驻留受限数据不得复制到未授权区域。

