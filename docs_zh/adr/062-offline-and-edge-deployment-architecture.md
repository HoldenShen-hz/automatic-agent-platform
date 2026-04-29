# ADR-062 离线与边缘部署架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

工厂、门店、移动设备等边缘场景无法访问云端，需要支持离线部署。

## 决策

### 部署模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| cloud | 云端完整部署 | 数据中心 |
| hybrid | 云+边缘协同 | 分支机构 |
| edge | 纯边缘部署 | 工厂/门店 |
| mobile | 移动设备 | 现场作业 |

### 边缘运行时

```typescript
interface EdgeRuntime {
  runtime_id: string;
  mode: EdgeMode;
  local_capabilities: LocalCapability;
  sync_config: SyncConfig;
  offline_queue: OfflineOperation[];
}
```

### 数据同步策略

| 同步模式 | 说明 | 网络需求 |
|----------|------|----------|
| realtime | 实时同步 | 稳定连接 |
| batch | 批量同步 | 间歇连接 |
| delay_tolerant | 容忍延迟 | 低带宽 |
| store_forward | 存储转发 | 完全离线 |

### 边缘能力

- 本地任务执行
- 本地知识库
- 本地状态缓存
- 离线任务队列

### 冲突解决

| 策略 | 适用范围 | 说明 |
|------|----------|------|
| server_wins | truth / budget / side effect 对象 | 服务端单 leader 写入（必须），符合 §25.11/§52.3 fencing 要求 |
| last_write_wins | projection / 非关键统计对象 | 客户端时间戳优先写入 |
| merge | projection / 非关键统计对象 | 合并冲突（可使用 CRDT） |
| manual | 所有对象 | 人工解决 |

**约束**：
- truth / budget / side effect 对象必须使用 `server_wins`（单 leader 写入 + fencing），不允许 `last_write_wins`
- projection / 非关键统计对象可使用 `last_write_wins` 或 `merge`
- §25.11/§52.3 要求单 leader 写入时不使用 fencing token 保护

## 后果

优点：

- 支持离线场景
- 降低网络依赖
- 扩大适用范围

代价：

- 同步复杂性
- 冲突处理复杂

## 交叉引用

- [ADR-052 多 Region 部署架构](./052-multi-region-deployment-architecture.md)
- [ADR-031 容灾与高可用架构](./031-disaster-recovery-and-high-availability.md)

## 来源章节

- `§62` 离线与边缘部署架构
