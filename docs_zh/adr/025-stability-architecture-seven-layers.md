# ADR-025 稳定性架构

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

企业级 Agent 平台必须具备完善的稳定性机制，应对各种故障场景：网络分区、依赖超时、资源耗尽等。

## 决策

### 七层稳定性架构

| 层级 | 机制 | 阈值/策略 |
|------|------|----------|
| L1 隔离 | 租户失败率 >30% 自动隔离 | AutoStopLossService |
| L2 限流背压 | 4 级 queue_lag 阈值 | 背压控制在 dispatcher |
| L3 超时重试 | 指数退避 base=1s max=60s | ExecutionStrategy |
| L4 熔断器 | 50% 失败率/60s → open → 30s half-open | CircuitBreaker |
| L5 降级模式 | 8 种运行模式 | PolicyMode enum |
| L6 恢复 | 6 种恢复 worker | RuntimeRecoveryService 等 |
| L7 可观测 | metrics/logs/traces/audit | shared/observability/ |

### PolicyMode 8 种运行模式

```typescript
enum PolicyMode {
  supervised = 'supervised',     // 人工监督
  auto = 'auto',                 // 自动模式
  full_auto = 'full_auto',       // 完全自动
  read_only = 'read_only',       // 只读
  maintenance = 'maintenance',   // 维护模式
  incident_mode = 'incident_mode', // 事件模式
  degraded = 'degraded',         // 降级模式
  emergency = 'emergency'         // 紧急模式
}
```

### 6 种恢复 Worker

1. RuntimeRecoveryService (622 行)
2. RuntimeRepairService (595 行)
3. RuntimeRecoveryDecisionService (355 行)
4. RuntimeRecoveryReplayService (700 行)
5. StalledExecutionEscalationService (130 行)
6. ExecutionDbQueueDisconnectRepairService (346 行)

### 自动回滚条件

| 条件 | 阈值 | 窗口 |
|------|------|------|
| 错误率超标 | > 1% | 5 分钟 |
| P99 延迟超标 | > 500ms | 5 分钟 |
| 成功率不达标 | < 99% | 5 分钟 |
| 连续失败次数 | > 10 | 10 分钟 |
| 资源耗尽 | Memory > 90% | 1 分钟 |

## 后果

优点：

- 七层防御覆盖常见故障场景
- 自动降级保证核心服务可用
- 6 种恢复 worker 实现自愈能力

代价：

- 多层机制增加系统复杂度
- 需要完善的监控告警配套

## 交叉引用

- [ADR-004 工作流与路由](./004-workflow-routing.md)
- [ADR-075 六级受控发布与 Rollout 状态机](./075-controlled-rollout-release.md)

## 来源章节

- `§9` 稳定性架构（7 层）
