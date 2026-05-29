# ADR-069 平台自运维 Agent Architecture

- Status：Partially Superseded by v4.3 control-plane and runtime authority ADRs
- Decision日期：2026-04-20

## Background

一人公司没有专职 SRE，平台需要能自我运维，减少人工干预。

## Decision

### 自运维能力

| 能力 | Description |
|------|------|
| 自动监控 | 指标采集和告警 |
| 自动诊断 | Root Cause分析 |
| 自动修复 | 常见Issue修复 |
| 自动扩缩容 | 负载response式伸缩 |
| 自动恢复 | 故障自愈 |

### 自运维 Agent 设计

```typescript
interface SelfOpsAgent {
  agent_id: string;
  capabilities: OpsCapability[];
  authorization: OpsAuthorization;
  boundaries: OpsBoundary;
}
```

### OpsCapability

| 能力 | 触发条件 | 执lines操作 |
|------|----------|----------|
| restart_service | 服务noresponse | 重启服务 |
| clear_cache | cache命中率低 | 清理cache |
| scale_up | 负载高 | 增加 Worker |
| scale_down | 负载低 | 减少 Worker |
| rotate_secrets | key即将过期 | 轮换key |

### permission边界

| 操作 | 需审批 | 自动执lines |
|------|--------|----------|
| 查看日志 | no | is |
| 重启服务 | is | no |
| 扩缩容 | is | configure范围内可自动 |
| 修改configure | is | no |
| data操作 | is | no |

- 任何会修改运lines时真相对象的动作，最终都必须下沉为 `OperationalDirective` 并via `RuntimeStateMachine.transition(command)` 落地，SelfOpsAgent 不能directly写 truth state。

### 人工干预

- 复杂Issue升级到人工
- 关键Decision需人工确认
- 定期人工评审

## Consequences

优点：

- 减少 SRE relies on
- 提高可用性
- 快速response故障

代价：

- 自运维逻辑复杂
- permission边界需要谨慎设计

## 交叉references用

- [ADR-025 稳定性Architecture](./025-stability-architecture-seven-layers.md)
- [ADR-058 紧急制动vsglobally熔断](./058-emergency-stop-and-global-circuit-breaker.md)

## 来源章节

- `§69` 平台自运维 Agent Architecture
