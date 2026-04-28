# ADR-052 多 Region 部署架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

企业跨地域运营，需要多 Region 部署以保证低延迟和高可用。

## 决策

### 多 Region 模型

```typescript
interface Region {
  region_id: string;
  name: string;
  location: GeoLocation;
  role: RegionRole;
  endpoints: RegionEndpoints;
}

type RegionRole = 'primary' | 'replica' | 'hot_standby';
```

### 流量路由

| 策略 | 说明 |
|------|------|
| latency_based | 基于延迟路由 |
| geo_based | 基于地理位置 |
| load_balanced | 负载均衡 |
| failover | 故障转移 |

### 数据同步

| 同步模式 | 说明 | RPO |
|----------|------|-----|
| async | 异步复制 | < 1s |
| eventual | 最终一致 | < 1min |

约束：

- v4.2/v4.3 不承诺多主 truth 写入，也不承诺跨 region `sync` 复制的 `RPO = 0`。
- `HarnessRun / NodeRun / BudgetLedger` truth 必须保持单 writer；跨 region 复制只允许 append-only evidence、read model 或异步 shadow data。
- 自动故障转移必须建立在 async replication、lease 接管与 fencing 校验之上，而不是假设多主同步真相写入。

### 故障转移

- 自动检测 Region 故障
- 自动将流量切换到备用 Region
- 故障 Region 修复后数据同步

## 后果

优点：

- 地理就近访问降低延迟
- Region 级故障不影响全局
- 合规要求（数据驻留）满足

代价：

- 多 Region 运维复杂度
- 跨 Region 数据一致性挑战

## 交叉引用

- [ADR-031 容灾与高可用架构](./031-disaster-recovery-and-high-availability.md)
- [ADR-053 规模化资源竞争管理](./053-scaling-resource-competition-management.md)

## 来源章节

- `§52` 多 Region 部署架构

## v4.3 ADR Remediation

- A-24: 本 ADR 原先列出 `sync` 复制并给出 `RPO=0`，根因是多 region ADR 复用了传统数据库部署话语，没有区分 append-only evidence 复制与 runtime truth 单 writer 边界。修复：正文现明确 v4.2/v4.3 只承认 async/eventual 复制，不承诺多主 truth 写入或 `RPO=0` 的 sync 复制。
