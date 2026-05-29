# ADR-062 离线vs边缘部署Architecture

- Status：Accepted
- Decision日期：2026-04-20

## Background

工厂、门店、移动设备等边缘场景no法访问云端，需要supported离线部署。

## Decision

### 部署模式

| 模式 | Description | 适用场景 |
|------|------|----------|
| cloud | 云端完整部署 | data中心 |
| hybrid | 云+边缘协同 | 分支机构 |
| edge | 纯边缘部署 | 工厂/门店 |
| mobile | 移动设备 | 现场作业 |

### 边缘运lines时

```typescript
interface EdgeRuntime {
  runtime_id: string;
  mode: EdgeMode;
  local_capabilities: LocalCapability;
  sync_config: SyncConfig;
  offline_queue: OfflineOperation[];
}
```

### datasynchronous策略

| synchronous模式 | Description | network需求 |
|----------|------|----------|
| realtime | 实时synchronous | 稳定connect |
| batch | 批量synchronous | 间歇connect |
| delay_tolerant | 容忍delay | 低带宽 |
| store_forward | storage转发 | 完全离线 |

### 边缘能力

- 本地任务执lines
- 本地知识库
- 本地Statuscache
- 离线任务队列

### conflicts解决

| 策略 | Description |
|------|------|
| last_write_wins | 最后writes胜出 |
| server_wins | 服务端优先 |
| merge | onlyused for projection / 非关键统计对象的合并conflicts |
| manual | 人工解决 |

## Consequences

优点：

- supported离线场景
- 降低networkrelies on
- 扩大适用范围

代价：

- synchronous复杂性
- conflictshandle复杂

## 交叉references用

- [ADR-052 多 Region 部署Architecture](./052-multi-region-deployment-architecture.md)
- [ADR-031 容灾vs高可用Architecture](./031-disaster-recovery-and-high-availability.md)

## 来源章节

- `§62` 离线vs边缘部署Architecture

## v4.3 ADR Remediation

- R3-60: 本 ADR defines `last_write_wins` 为conflicts解Decision略之一，vs §25.11 真相data要求不矛盾。Root cause: 边缘部署场景（工厂、门店等）的离线datasynchronousvs中心化真相data系统有不同的约束。修复：正文明确 `last_write_wins` only适used for边缘临时datasynchronous场景，不适used for需要保持真相一致性的核心Statusdata；后者必须uses `server_wins` 或 `merge` 策略。
- `merge` 同样只允许used for projection / cache / 非权威统计对象；`truth / budget / side effect` 仍必须via过中心化 authoritative writer vs fencing 保护。
