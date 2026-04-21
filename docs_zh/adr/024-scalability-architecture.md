# ADR-024 可扩展性架构

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

平台需要支持从单机到集群的平滑扩展，同时保持数据一致性和性能。不同规模阶段需要不同的架构策略。

## 决策

### 分层扩展策略

| 阶段 | 架构 | 并发能力 | 存储 | Workers |
|------|------|---------|------|---------|
| S1 | 单机 | ≤10 | SQLite | 5 |
| S2 | 多进程 | 10-100 | SQLite + Redis | 20 |
| S3 | 分布式 | 100-1000 | PostgreSQL | 100 |
| S4 | K8s 集群 | 5000+ | PG sharded | 500+ |

### 队列分片策略

- dispatch queue 按 tenant_id hash 分片
- 保证租户间隔离

### HorizontalScalingController

- `shared/scaling/` 实现水平扩展控制器
- 支持基于负载的自动扩缩容

### S3 特殊说明

- 使用 PostgreSQL + SQLite 双运行模式
- SQLite 作为本地缓存
- PG 作为主存储
- 无异步镜像（同步复制）

## 后果

优点：

- 分层扩展策略匹配不同业务阶段
- 队列分片防止单租户阻塞
- 水平扩展控制器支持自动伸缩

代价：

- 多阶段架构增加运维复杂度
- S3/S4 需要更多基础设施投入

## 交叉引用

- [ADR-012 SQLite 是否作为 Phase 1-2 唯一主存储](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-031 容灾与高可用架构](./031-disaster-recovery-and-high-availability.md)

## 来源章节

- `§8` 可扩展性架构
