# ADR-069 平台自运维 Agent 架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

一人公司没有专职 SRE，平台需要能自我运维，减少人工干预。

## 决策

### 自运维能力

| 能力 | 说明 |
|------|------|
| 自动监控 | 指标采集和告警 |
| 自动诊断 | 根因分析 |
| 自动修复 | 常见问题修复 |
| 自动扩缩容 | 负载响应式伸缩 |
| 自动恢复 | 故障自愈 |

### 自运维 Agent 设计

```typescript
interface SelfOpsAgent {
  agent_id: string;
  capabilities: OpsCapability[];
  authorization: OpsAuthorization;
  boundaries: OpsBoundary;
}

interface OpsActionProposal {
  proposal_id: string;
  action_type: string;
  scope: { tenantId?: string; harnessRunId?: string; nodeRunId?: string; workerId?: string };
  target_runtime_mode: "full_auto" | "supervised_auto" | "read_only" | "no_write" | "no_external_call" | "no_rollout" | "manual_only" | "incident_mode";
  evidence_refs: string[];
  governance_gate: "auto" | "approval_required" | "break_glass";
}
```

### OpsCapability

| 能力 | 触发条件 | 执行操作 |
|------|----------|----------|
| restart_service | 服务无响应 | 通过 RuntimeStateMachine.transition(OperationalDirective) + HarnessRuntime 重启服务 |
| clear_cache | 缓存命中率低 | 清理缓存 |
| scale_up | 负载高 | 通过 RuntimeStateMachine.transition(OperationalDirective) + HarnessRuntime 增加 Worker |
| scale_down | 负载低 | 通过 RuntimeStateMachine.transition(OperationalDirective) + HarnessRuntime 减少 Worker |
| rotate_secrets | 密钥即将过期 | 通过 RuntimeStateMachine.transition(OperationalDirective) 轮换密钥 |

所有直接执行操作需通过 RuntimeStateMachine.transition(OperationalDirective) + HarnessRuntime + PlanGraphBundle 上下文，确保操作可审计、可回滚。依据 §5.3，所有状态变更必须走 canonical 控制路径。

所有自运维动作必须先形成 `OpsActionProposal`，再由治理门禁决定 `auto / approval_required / break_glass` 路径。

### 权限边界

| 操作 | 需审批 | 自动执行 |
|------|--------|----------|
| 查看日志 | 否 | 是 |
| 重启服务 | 是 | 否 |
| 扩缩容 | 是 | 配置范围内可自动 |
| 修改配置 | 是 | 否 |
| 数据操作 | 是 | 否 |

### 人工干预

- 复杂问题升级到人工
- 关键决策需人工确认
- 定期人工评审

## 后果

优点：

- 减少 SRE 依赖
- 提高可用性
- 快速响应故障

代价：

- 自运维逻辑复杂
- 权限边界需要谨慎设计

## 交叉引用

- [ADR-025 稳定性架构](./025-stability-architecture-seven-layers.md)
- [ADR-058 紧急制动与全局熔断](./058-emergency-stop-and-global-circuit-breaker.md)

## 来源章节

- `§69` 平台自运维 Agent 架构

## v4.3 ADR Remediation

- R6-54: 修复 OpsCapability 缺少 HarnessRuntime 上下文且未走 canonical 控制路径。ADR-069 原先描述 restart_service/scale_up/rotate_secrets 为直接执行操作，未经过 RuntimeStateMachine.transition()/OperationalDirective，导致状态变更无法审计和回滚。修复：所有直接执行操作现通过 RuntimeStateMachine.transition(OperationalDirective) + HarnessRuntime + PlanGraphBundle 上下文执行，确保符合 §5.3 要求。
