# ADR-053 规模化资源竞争管理

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

多业务线并发运行时会出现资源竞争，需要公平有效的资源分配机制。

## 决策

### 资源池模型

ResourcePool/ResourceAllocation 与 BudgetLedger/BudgetReservation 深度集成，统一管理资源分配与预算扣费，三者共同构成资源分配的原子单元：

```typescript
interface ResourcePool {
  pool_id: string;
  resource_type: ResourceType;
  capacity: number;
  allocation: ResourceAllocation[];
}

interface ResourceAllocation {
  tenant_id: string;
  reserved: number;
  used: number;
  priority: number;
  budgetLedgerEntry: string;  // 关联 BudgetLedger 记录
}
```

### 资源类型

| 类型 | 说明 |
|------|------|
| compute | 计算资源 |
| memory | 内存资源 |
| storage | 存储资源 |
| api_quota | API 调用配额 |
| llm_token | LLM Token 配额 |

### 调度策略

| 策略 | 说明 |
|------|------|
| priority | 优先级优先 |
| fair_share | 公平分享 |
| fifo | 先来先服务 |
| weighted_fair | 加权公平队列 |

### 资源配额

- 平台级配额
- 租户级配额
- 业务域级配额
- 动态调整

## 后果

优点：

- 公平的资源分配防止饿死人
- 优先级机制保证关键业务
- 动态调整适应负载变化

代价：

- 调度算法复杂度
- 配额计算开销

## 交叉引用

- [ADR-024 可扩展性架构](./024-scalability-architecture.md)
- [ADR-054 SLA 分级保障](./054-sla-tiered-guarantees.md)

## 来源章节

- `§53` 规模化资源竞争管理
