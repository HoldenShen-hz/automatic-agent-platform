# ADR-024 可扩展性Architecture

- Status：Accepted
- Decision日期：2026-04-03

## Background

平台需要supported从单机到集群的平滑扩展，同时保持data一致性和性能。不同规模阶段需要不同的Architecture策略。

## Decision

### 分层扩展策略

| 阶段 | Architecture | concurrent能力 | storage | Workers |
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
- supportedbased on负载的自动扩缩容

### S3 特殊Description

- uses PostgreSQL + SQLite 双运lines模式
- SQLite 作为本地cache
- PG 作为主storage
- no异步镜像（synchronous复制）

## Consequences

优点：

- 分层扩展策略匹配不同业务阶段
- 队列分片防止单租户阻塞
- 水平扩展控制器supported自动伸缩

代价：

- 多阶段Architecture增加运维复杂度
- S3/S4 需要更多基础设施投入

## 交叉references用

- [ADR-012 SQLite isno作为 Phase 1-2 唯一主storage](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-031 容灾vs高可用Architecture](./031-disaster-recovery-and-high-availability.md)

## 来源章节

- `§8` 可扩展性Architecture
