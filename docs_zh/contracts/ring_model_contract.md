# Ring Model Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR Improve Hub 的 ring-based 渐进部署机制和 ring promotion criteria，对应 ADR-075 §33 和设计文档 §9。
> **更新日期**：2026-04-29

## 1. Scope

本 contract 定义六级受控发布（L0-L5）的 ring 模型、ring promotion criteria 和渐进式部署策略。

Related documents:

- `release_rollout_and_rollback_contract.md`
- [ADR-075 六级受控发布](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 2. Ring Model Overview

Ring Model 提供渐进式部署机制，通过分级流量分配和 promotion criteria 控制来降低生产风险。

### 2.1 Ring Levels

| Ring | Name | Traffic | AI 自主权限 | 人类审批 | 典型场景 |
|------|------|---------|------------|---------|---------|
| Ring 0 | `off` | 0% | 无操作权限，仅记录 | — | 禁用发布 |
| Ring 1 | `evaluate_0` | 0%（仅记录） | candidate evaluation / evidence validation | — | 候选评估 |
| Ring 2 | `canary_5` | 5% | 参数调整、策略选择 | critical/high 需审批 | 小规模验证 |
| Ring 3 | `partial_25` | 25% | 配置建议 | 全部需审批 | 扩大验证 |
| Ring 4 | `stable_75` | 75% | 执行配置变更 | 全部必须审批 | 接近全量 |
| Ring 5 | `stable_100` | 100% | 完全自主（受 guardrail 约束） | 仅异常升级 | 全量发布 |

## 3. Ring Promotion Criteria

### 3.1 Automatic Promotion Requirements

从当前 ring 升级到下一 ring 必须满足以下 criteria：

| 指标 | 阈值 | 窗口 | 说明 |
|------|------|------|------|
| 错误率 | < 1% | 连续 5 分钟 | 生产错误率必须低于阈值 |
| P99 延迟 | < 500ms | 连续 5 分钟 | 端到端延迟必须低于阈值 |
| 成功率 | > 99% | 连续 5 分钟 | 成功率必须高于阈值 |
| 样本数 | > 100 | 累积 | 最小样本数以确保统计显著性 |

### 3.2 Manual Promotion Approval

对于 critical/high priority 的改进候选，必须获得人类审批才能从 Ring 2 升级到 Ring 3。

### 3.3 Auto-Rollback Criteria

如果以下条件触发，系统自动回滚到上一 ring 或 Ring 1：

| 条件 | 阈值 | 窗口 | 动作 |
|------|------|------|------|
| 错误率超标 | > 1% | 5 分钟 | L4→L3 |
| P99 延迟超标 | > 500ms | 5 分钟 | L4→L3 |
| 成功率不达标 | < 99% | 5 分钟 | L4→L3 |
| 连续失败次数 | > 10 | 10 分钟 | 直接回滚 L1 |
| 资源耗尽 | Memory > 90% | 1 分钟 | 直接回滚 L1 |

## 4. Ring Interface

### 4.1 RingStatus

```typescript
type RingStatus =
  | "off"           // Ring 0 - 禁用
  | "evaluate_0"   // Ring 1 - 仅评估
  | "canary_5"      // Ring 2 - 5% 流量
  | "partial_25"    // Ring 3 - 25% 流量
  | "stable_75"     // Ring 4 - 75% 流量
  | "stable_100";   // Ring 5 - 全量
```

### 4.2 RingMetrics

```typescript
interface RingMetrics {
  errorRate: number;
  latencyP99: number;
  successRate: number;
  sampleCount: number;
  measuredAt: string;
}
```

### 4.3 RingPromotionRequest

```typescript
interface RingPromotionRequest {
  candidateId: string;
  currentRing: RingStatus;
  targetRing: RingStatus;
  metrics: RingMetrics;
  requestedBy: "scheduler" | "human";
  requestedAt: string;
}
```

### 4.4 RingPromotionDecision

```typescript
interface RingPromotionDecision {
  requestId: string;
  candidateId: string;
  approved: boolean;
  currentRing: RingStatus;
  targetRing: RingStatus;
  reason?: string;
  decidedBy: "scheduler" | "human" | "auto_rollback";
  decidedAt: string;
}
```

## 5. Ring Transition Rules

### 5.1 Valid Transitions

```
off (R0)
  ↓ (人工启用)
evaluate_0 (R1)
  ↓ (自动：满足 criteria)
canary_5 (R2)
  ↓ (自动：满足 criteria + 人类审批 for critical/high)
partial_25 (R3)
  ↓ (自动：满足 criteria)
stable_75 (R4)
  ↓ (自动：满足 criteria)
stable_100 (R5)
  ↓ (持续 M 天无问题)
released
```

### 5.2 Rollback Transitions

任意 ring 均可回滚到任意更低 ring，回滚来源：
- 自动回滚（指标触发）
- 人工回滚（操作员决策）

## 6. Autonomy Boundary per Ring

| Ring | AI 自主权限 | 人类审批要求 |
|------|------------|------------|
| R0-R1 | 完全自主（仅记录） | 不需要 |
| R2 | 参数调整、策略选择 | 需要 for critical/high |
| R3 | 配置变更建议 | 需要 for all |
| R4 | 执行配置变更 | 必须 for all |
| R5 | 完全自主（受 guardrail 约束） | 仅异常升级 |

## 7. Implementation Requirements

### 7.1 Ring Lifecycle Manager

```typescript
interface RingLifecycleManager {
  // 初始化 ring 状态
  initializeRing(candidateId: string, initialRing: RingStatus): Promise<void>;

  // 请求 promotion
  requestPromotion(request: RingPromotionRequest): Promise<RingPromotionDecision>;

  // 执行回滚
  executeRollback(candidateId: string, targetRing: RingStatus, reason: string): Promise<void>;

  // 获取当前 ring 状态
  getCurrentRing(candidateId: string): Promise<RingStatus>;

  // 获取 ring 历史
  getRingHistory(candidateId: string): Promise<RingPromotionDecision[]>;
}
```

### 7.2 Metrics Collector

```typescript
interface RingMetricsCollector {
  // 收集指定 ring 的指标
  collectMetrics(candidateId: string, ring: RingStatus): Promise<RingMetrics>;

  // 评估是否满足 promotion criteria
  evaluatePromotionCriteria(metrics: RingMetrics): PromotionCriteriaResult;

  // 评估是否满足 rollback criteria
  evaluateRollbackCriteria(metrics: RingMetrics): RollbackCriteriaResult;
}
```

## 8. Testing Requirements

### 8.1 Unit Tests

- Ring transition state machine
- Promotion criteria evaluation
- Rollback criteria evaluation
- Autonomy boundary enforcement

### 8.2 Integration Tests

- Ring promotion flow end-to-end
- Auto-rollback trigger and execution
- Human approval workflow for critical/high priority

### 8.3 Contract Tests

- Ring metrics 必须满足 §33 定义的阈值
- 未满足 criteria 不得 promote
- Auto-rollback 必须在指标超标时触发

## 9. Closure Conclusion

Ring Model 不是简单的百分比分割，而是包含严格 criteria、自动化 gate 和人类审批点的渐进式部署机制。任何一个 ring 的 promotion 都必须经过明确的 criteria 验证，回滚机制确保问题可以被及时控制。