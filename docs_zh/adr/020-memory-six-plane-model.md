# ADR-020 Memory 六层平面与自动晋升规则

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

- 状态：Accepted
- 决策日期：2026-04-17

## 背景

§F 设计文档定义了六层 Memory 平面（L1-L6）和层间晋升规则。当前 `memory/` 实现了 L1-L3（RuntimeCache / Session / Agent），L4-L6（Project / User / Evolution）缺失，且无自动晋升引擎。

## 决策

### 六层 Memory 平面

| 层级 | 名称 | 粒度 | TTL | 存储位置 |
|------|------|------|-----|---------|
| **L1** | RuntimeCache | task 级别 | 执行期间 | 内存 |
| **L2** | Session | session 级别 | session 结束后 24h | SQLite |
| **L3** | Agent | agent 级别 | 7 天无访问 | SQLite |
| **L4** | Project | project 级别 | 30 天无访问 | SQLite |
| **L5** | User | user 级别 | 90 天无访问 | SQLite |
| **L6** | Evolution | 全局 | 手动删除 | SQLite |

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
  // 评估单条记录是否满足晋升条件
  evaluatePromotion(entry: MemoryRecord): PromotionDecision;
  // 批量扫描并执行晋升
  runPromotionCycle(): Promise<PromotionResult>;
  // 降级规则（反向）
  evaluateDemotion(entry: MemoryRecord): DemotionDecision;
}
```

### 当前实现状态

- `src/core/memory/memory-service.ts`：L1-L3 已实现。
- `src/core/memory/memory-layer-model.ts`：待创建（层级定义）。
- `src/core/memory/memory-promotion-engine.ts`：待创建（晋升引擎）。
- `src/core/memory/project-memory-store.ts`：待创建（L4）。
- `src/core/memory/user-memory-store.ts`：待创建（L5）。

## 后果

- 六层 Memory 模型使系统具备从"执行时缓存"到"长期知识沉淀"的完整生命周期。
- L4-L6 是实现"项目记忆"和"用户偏好学习"的基础设施。
- 晋升规则确保高频高质记忆自动进入更持久层，低价值记忆自然衰减。
