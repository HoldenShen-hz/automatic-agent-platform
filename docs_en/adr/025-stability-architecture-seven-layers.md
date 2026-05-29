# ADR-025 稳定性Architecture

- Status：Accepted
- Decision日期：2026-04-03

## Background

企业级 Agent 平台必须具备完善的稳定性机制，应对各种故障场景：network分区、relies ontimeout、资源耗尽等。

## Decision

### 七层稳定性Architecture

| 层级 | 机制 | threshold/策略 |
|------|------|----------|
| L1 隔离 | 租户failed率 >30% 自动隔离 | AutoStopLossService |
| L2 限流背压 | 4 级 queue_lag threshold | 背压控制在 dispatcher |
| L3 timeout重试 | 指数退避 base=1s max=60s | ExecutionStrategy |
| L4 熔断器 | 50% failed率/60s → open → 30s half-open | CircuitBreaker |
| L5 降级模式 | 8 种运lines模式 | PolicyMode enum |
| L6 恢复 | 6 种恢复 worker | RuntimeRecoveryService 等 |
| L7 可观测 | metrics/logs/traces/audit | shared/observability/ |

### PolicyMode 8 种运lines模式

```typescript
enum PolicyMode {
  full_auto = 'full_auto',
  supervised_auto = 'supervised_auto',
  read_only = 'read_only',
  no_write = 'no-write',
  no_external_call = 'no-external-call',
  no_rollout = 'no-rollout',
  manual_only = 'manual_only',
  incident_mode = 'incident-mode'
}
```

### 6 种恢复 Worker

1. RuntimeRecoveryService (622 lines)
2. RuntimeRepairService (595 lines)
3. RuntimeRecoveryDecisionService (355 lines)
4. RuntimeRecoveryReplayService (700 lines)
5. StalledExecutionEscalationService (130 lines)
6. ExecutionDbQueueDisconnectRepairService (346 lines)

### 自动回滚条件

| 条件 | threshold | 窗口 |
|------|------|------|
| 错误率exceeds标 | > 1% | 5 分钟 |
| P99 delayexceeds标 | > 500ms | 5 分钟 |
| success率不达标 | < 99% | 5 分钟 |
| 连续failediterations数 | > 10 | 10 分钟 |
| 资源耗尽 | Memory > 90% | 1 分钟 |

## Consequences

优点：

- 七层防御覆盖常见故障场景
- 自动降级保证核心服务可用
- 6 种恢复 worker 实现自愈能力

代价：

- 多层机制增加系统复杂度
- 需要完善的监控告警配套

## 交叉references用

- [ADR-004 工作流vs路由](./004-workflow-routing.md)
- [ADR-075 六级受控发布vs Rollout Status机](./075-controlled-rollout-release.md)

## 来源章节

- `§9` 稳定性Architecture（7 层）

## v4.3 ADR Remediation

- A-19: 本 ADR 原先把 `supervised / degraded / maintenance / emergency` 混入 canonical `PolicyMode`，Root cause: 稳定性 ADR 把告警/运营语义和运lines时强约束模式合并成一套枚举。修复：正文现把模式枚举收敛到主Architecture规定的 8 种 runtime mode：`full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode`。
