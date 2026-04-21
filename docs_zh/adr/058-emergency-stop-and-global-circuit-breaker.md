# ADR-058 紧急制动与全局熔断架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

安全事件发生时需要能瞬时停止全平台 Agent 操作，全局熔断机制防止故障扩散。

## 决策

### 紧急制动级别

| 级别 | 名称 | 影响范围 |
|------|------|----------|
| L0 | 无 | 正常运行 |
| L1 | pause_new | 暂停新任务创建 |
| L2 | pause_all | 暂停所有执行 |
| L3 | kill_all | 终止所有运行中任务 |
| L4 | lockdown | 锁定平台，只允许读操作 |

### 触发条件

| 条件 | 级别 |
|------|------|
| 手动触发 | L1-L4 |
| SEV1 事件 | L2 |
| 连续失败 >90% | L3 |
| 安全攻击检测 | L4 |

### 全局熔断器

```typescript
interface GlobalCircuitBreaker {
  state: 'closed' | 'open' | 'half_open';
  threshold: number;       // 失败率阈值
  window_ms: number;      // 统计窗口
  open_duration_ms: number; // 熔断持续时间
}
```

### 恢复流程

1. 事件解决
2. 人工确认
3. 降级观察（half_open）
4. 逐步恢复流量
5. 完全恢复

### 权限控制

- 紧急制动需要特定权限
- 操作需要二次确认
- 所有操作记录审计日志

## 后果

优点：

- 快速响应安全事件
- 防止故障扩散
- 分级恢复减少冲击

代价：

- 紧急制动影响业务连续性
- 恢复流程需要精心设计

## 交叉引用

- [ADR-025 稳定性架构](./025-stability-architecture-seven-layers.md)
- [ADR-059 Agent 可解释性](./059-agent-explainability-and-decision-transparency.md)

## 来源章节

- `§60` 紧急制动与全局熔断架构
