# ADR-053 规模化资源竞争manage

- Status：Accepted
- Decision日期：2026-04-20

## Background

多业务线concurrent运lines时会出现资源竞争，需要公平有效的资源分配机制。

## Decision

### 资源池模型

ResourcePool/ResourceAllocation vs BudgetLedger/BudgetReservation 深度集成，统一manage资源分配vsbudget扣费，三者共同构成资源分配的原子单元：

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
  budgetLedgerEntry: string;  // 关联 BudgetLedger record
}
```

### 资源class型

| class型 | Description |
|------|------|
| compute | 计算资源 |
| memory | 内存资源 |
| storage | storage资源 |
| api_quota | API call配额 |
| llm_token | LLM Token 配额 |

### 调度策略

| 策略 | Description |
|------|------|
| priority | 优先级优先 |
| fair_share | 公平分享 |
| fifo | 先来先服务 |
| weighted_fair | 加权公平队列 |

### 资源配额

- 平台级配额
- 租户级配额
- 业务域级配额
- dynamically调整

## Consequences

优点：

- 公平的资源分配防止饿死人
- 优先级机制保证关键业务
- dynamically调整适应负载变化

代价：

- 调度算法复杂度
- 配额计算开销

## 交叉references用

- [ADR-024 可扩展性Architecture](./024-scalability-architecture.md)
- [ADR-054 SLA 分级保障](./054-sla-tiered-guarantees.md)

## 来源章节

- `§53` 规模化资源竞争manage
