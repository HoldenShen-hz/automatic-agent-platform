# ADR-058 紧急制动vsglobally熔断Architecture

- Status：Accepted
- Decision日期：2026-04-20

## Background

security事件发生时需要能transient停止全平台 Agent 操作，globally熔断机制防止故障扩散。

## Decision

### 紧急制动级别

| 级别 | 名称 | Impact范围 |
|------|------|----------|
| L0 | no | 正常运lines |
| L1 | pause_new | via `OperationalDirective(type=pause_run)` 或 admission gate 暂停新 run |
| L2 | pause_all | via `PlatformPanicDirective(scope=platform)` 暂停全平台执lines |
| L3 | kill_all | via `OperationalDirective(type=kill_run)` 或 `PlatformPanicDirective(scope=platform)` 终止运lines中 run |
| L4 | lockdown | via `PlatformPanicDirective(mode=incident-mode)` 锁定平台，只允许读操作 |

### 触发条件

| 条件 | 级别 |
|------|------|
| 手动触发 | L1-L4 |
| SEV1 事件 | L2 |
| 连续failed >90% | L3 |
| security攻击检测 | L4 |

### globally熔断器

```typescript
interface GlobalCircuitBreaker {
  state: 'closed' | 'open' | 'half_open';
  threshold: number;       // failed率threshold
  window_ms: number;      // 统计窗口
  open_duration_ms: number; // 熔断持续time（不contains自动解除语义）
}

约束：
- `open_duration_ms` onlydefines熔断持续time，不代table TTL 自动解除。
- 熔断器从 `open` 转为 `half_open` 必须via显式call `circuit_breaker.half_open()` 或人工干预。
- 禁止在 `open` Status未via过渡directly自动恢复为 `closed`。
- `half_open` Status下若探测requestsuccess率达threshold，方可转为 `closed`；no则回退为 `open`。
```

### 恢复流程

1. 事件解决
2. 人工确认
3. 降级观察（half_open）
4. 逐步恢复流量
5. 完全恢复

### permission控制

- 紧急制动需要特定permission
- 操作需要二iterations确认
- 所有操作record审计日志
- 紧急制动必须落到正式机制：`PlatformPanicDirective` 或 `OperationalDirective`，不得以裸开关variable或旁路脚本directly替代。

## Consequences

优点：

- 快速responsesecurity事件
- 防止故障扩散
- 分级恢复减少冲击

代价：

- 紧急制动Impact业务连续性
- 恢复流程需要精心设计

## 交叉references用

- [ADR-025 稳定性Architecture](./025-stability-architecture-seven-layers.md)
- [ADR-059 Agent 可解释性](./059-agent-explainability-and-decision-transparency.md)

## 来源章节

- `§60` 紧急制动vsglobally熔断Architecture

## v4.3 ADR Remediation

- A-25: 本 ADR 原先只defines `L0-L4` 级别名，没有把它们绑定到正式Control Plane机制，Root cause: 紧急制动 ADR 先从运维 playbook 起草，后续没有跟 `PlatformPanicDirective / OperationalDirective` 主干合约对齐。修复：正文现把各级别明确绑定到 `PlatformPanicDirective` 或 `OperationalDirective(type=kill_run / pause_run)`。
