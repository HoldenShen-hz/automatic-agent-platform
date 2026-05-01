# ADR-018 Rollout 十一态状态机与六阶段发布

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：信号采集与统一 DTO
- **Assess**：执行前/后评估与风险判断
- **Plan**：显式规划与 DAG 构建（ADR-060）
- **Execute**：步骤执行与 Dual-Channel 输出
- **Feedback**：信号收集、预处理与 7 类反馈源（ADR-079）
- **Learn**：模式检测与知识提取（ADR-080）
- **Improve**：改进候选评估与 Rollout 状态机（ADR-075）
- **Release**：六级受控发布与自动回滚

---

- 状态：Superseded by ADR-075
- 决策日期：2026-04-17
- 被取代：ADR-075 (2026-04-17) 重新定义了六级发布状态机，Level 和状态集合与 ADR-018 不兼容

## 背景

§9 定义了五级发布（L0-L5）和 11 态 RolloutStatus 状态机。当前 `rollout-state-machine.ts` 仅实现了 3 态（off → suggest → shadow），无法支持渐进式发布（canary → staged → stable）和自动回滚。

## 决策

> **⚠️ DEPRECATED/REMOVED per ADR-075** — The specifications below are superseded
> and should NOT be used. ADR-075 defines the authoritative six-level state machine.
> This document is retained for historical reference only.

### 十一态 RolloutStatus 枚举 (REMOVED - use ADR-075 state machine)

```
draft
  ↓ (guardrail pass)
pending_approval
  ↓           ↓ (rejected)
shadow        rejected
  ↓ (24h)
canary_5      ← 5% 流量
  ↓ (metrics gate: error_rate < 0.5%, p99 < 2x baseline)
partial_25    ← 25% 流量
  ↓
partial_50    ← 50% 流量
  ↓
partial_75    ← 75% 流量
  ↓
stable        ← 100% 流量，视为 adopted
  ↓
rolled_back   ← 自动或手动回滚
  ↓
paused        ← 暂停，可恢复
```

### 五级发布 (REMOVED - use ADR-075 six-level release)

| 级别 | 名称 | 流量 | 适用场景 |
|------|------|------|---------|
| L0 | off | 0% | 禁用 |
| L1 | suggest | 0% | 仅建议，不自动执行 |
| L2 | shadow | 0% | shadow mode，不影响生产 |
| L3 | canary | 1-10% | 小流量验证 |
| L4 | staged | 25-75% | 灰度发布 |
| L5 | stable | 100% | 全量发布 |

### 自动回滚规则 (REMOVED - use ADR-075 rollback rules)

当以下任一条件满足时，自动触发 `rolled_back`：

- `failureRate > 5%`（5 分钟窗口）
- `p99Latency > 2x baseline`

### 当前实现状态

- `src/core/improvement/rollout/rollout-state-machine.ts`：3/11 态，需扩展。
- `src/core/improvement/auto-rollback-service.ts`：待创建。
- `src/core/improvement/canary-traffic-router.ts`：待创建。

## 后果

- Rollout 状态机扩展是 Sprint 2 的核心工作之一（ GAP-V2-07）。
- 完整的 11 态 + 自动回滚使系统具备生产级渐进发布能力。
- RolloutRecord 必须持久化所有状态转换历史，用于审计和 RCA。
