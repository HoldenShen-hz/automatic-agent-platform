# ADR-020 Memory 六层平面vs自动晋升规则

---

## OAPEFLIR 关联

本文档defines OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：信号采集vs统一 DTO
- **Assess**：执lines前/后评估vs风险判断
- **Plan**：显式规划vs DAG 构建（ADR-060）
- **Execute**：步骤执linesvs Dual-Channel 输出
- **Feedback**：信号收集、预handlevs 7 class反馈源（ADR-079）
- **Learn**：模式检测vs知识提取（ADR-080）
- **Improve**：改进候选评估vs Rollout Status机（ADR-075）
- **Release**：六级受控发布vs自动回滚

---

- Status：Accepted
- Decision日期：2026-04-17

## Background

§F 设计文档defines了六层 Memory 平面（L1-L6）和层间晋升规则。当前 `memory/` 实现了 L1-L3（RuntimeCache / Session / Agent），L4-L6（Project / User / Evolution）缺失，且no自动晋升references擎。

## Decision

### 六层 Memory 平面

| 层级 | 名称 | 粒度 | TTL | storage位置 |
|------|------|------|-----|---------|
| **L1** | RuntimeCache | task 级别 | 执lines期间 | 内存 |
| **L2** | Session | session 级别 | session 结束后 24h | SQLite |
| **L3** | Agent | agent 级别 | 7 天no访问 | SQLite |
| **L4** | Project | project 级别 | 30 天no访问 | SQLite |
| **L5** | User | user 级别 | 90 天no访问 | SQLite |
| **L6** | Evolution | globally | 手动删除 | SQLite |

### 层间晋升规则

| 晋升路径 | 触发条件 | 检查频率 |
|---------|---------|---------|
| L2 → L3 | accessCount ≥ 3 **且** qualityScore ≥ 0.6 | 每小时批量 |
| L3 → L4 | accessCount ≥ 10 **且** qualityScore ≥ 0.8 | 每小时批量 |
| L4 → L5 | accessCount ≥ 20 **且** qualityScore ≥ 0.85 | 每日批量 |
| L5 → L6 | manual promotion only | — |

### MemoryPromotionEngine 接口

```typescript
interface MemoryPromotionEngine {
  // 评估单条recordisno满足晋升条件
  evaluatePromotion(entry: MemoryRecord): PromotionDecision;
  // 批量扫描并执lines晋升
  runPromotionCycle(): Promise<PromotionResult>;
  // 降级规则（反向）
  evaluateDemotion(entry: MemoryRecord): DemotionDecision;
}
```

### 当前实现Status

- `src/platform/five-plane-state-evidence/memory/memory-service.ts`：L1-L3 已实现。
- `src/platform/five-plane-state-evidence/memory/memory-layer-model.ts`：待创建（层级defines）。
- `src/platform/five-plane-state-evidence/memory/memory-promotion-engine.ts`：待创建（晋升references擎）。
- `src/platform/five-plane-state-evidence/memory/project-memory-store.ts`：待创建（L4）。
- `src/platform/five-plane-state-evidence/memory/user-memory-store.ts`：待创建（L5）。

## Consequences

- 六层 Memory 模型使系统具备从"执lines时cache"到"长期知识沉淀"的完整生命cycle。
- L4-L6 is实现"项目记忆"和"user偏好学习"的基础设施。
- 晋升规则确保高频高质记忆自动进入更持久层，低价值记忆自然衰减。
