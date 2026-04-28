# ADR-054 SLA 分级保障

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

不同业务对 SLA 有不同需求，平台需要支持 SLA 分级保障。

## 决策

### SLA 等级

| 等级 | 名称 | 可用性 | 响应时间 | 并发 |
|------|------|--------|----------|------|
| platinum | 铂金 | 99.99% | < 100ms | 1000+ |
| gold | 金 | 99.9% | < 500ms | 500 |
| silver | 银 | 99.5% | < 1s | 100 |
| bronze | 铜 | 99% | < 5s | 50 |

### SLA 指标

```typescript
interface SLARequirement {
  tier: SLATier;
  availability: number;      // 百分比
  latency_p99_ms: number;
  throughput_rpm: number;
  error_rate_max: number;
}
```

### SLA 监控

- 实时 SLA 指标采集
- SLA 违规预警
- SLA 报告生成

### SLA 补偿

| 违规类型 | 补偿方式 |
|----------|----------|
| 可用性不达标 | 服务延长 |
| 延迟超标 | 部分退款 |
| 错误率超标 | 积分补偿 |

补充前置条件：

- `platinum` 只有在自动 failover、quorum、容量预留与演练证据全部具备时才允许对外承诺。
- 所有 SLA 承诺都必须可回链到 `HarnessRun / NodeRun / NodeAttemptReceipt` 证据。

## 后果

优点：

- 分级服务满足不同业务需求
- SLA 补偿增强用户信任
- 监控指标便于问题定位

代价：

- 多级 SLA 增加运维复杂度
- 补偿计算需要精确

## 交叉引用

- [ADR-053 规模化资源竞争管理](./053-scaling-resource-competition-management.md)
- [平台架构 §27 性能架构与 SLO](../architecture/00-platform-architecture.md)

## 来源章节

- `§54` SLA 分级保障
