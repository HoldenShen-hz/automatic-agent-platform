# ADR-054 SLA 分级保障

- Status：Accepted
- Decision日期：2026-04-20

## Background

不同业务对 SLA 有不同需求，平台需要supported SLA 分级保障。

## Decision

### SLA 等级

| 等级 | 名称 | 可用性 | responsetime | concurrent | 前置条件 |
|------|------|--------|----------|------|----------|
| platinum | 铂金 | 99.95% | < 100ms | 1000+ | 必须：自动 failover + quorum + 容量预留 + 演练证据 |
| gold | 金 | 99.9% | < 500ms | 500 | - |
| silver | 银 | 99.5% | < 1s | 100 | - |
| bronze | 铜 | 99% | < 5s | 50 | - |

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

| 违规class型 | 补偿方式 |
|----------|----------|
| 可用性不达标 | 服务延长 |
| delayexceeds标 | 部分退款 |
| 错误率exceeds标 | 积分补偿 |

所有 SLA 承诺都必须可回链到 `HarnessRun / NodeRun / NodeAttemptReceipt` 证据。

补充Description：

- `99.99%` 只允许在专用部署或专属合同中单独承诺，不应作为平台defaults to platinum 层级writes通用 ADR。

## Consequences

优点：

- 分级服务满足不同业务需求
- SLA 补偿增强user信任
- 监控指标便于Issue定位

代价：

- 多级 SLA 增加运维复杂度
- 补偿计算需要精确

## 交叉references用

- [ADR-053 规模化资源竞争manage](./053-scaling-resource-competition-management.md)
- [平台Architecture §27 性能Architecturevs SLO](../architecture/00-platform-architecture.md)

## 来源章节

- `§54` SLA 分级保障
