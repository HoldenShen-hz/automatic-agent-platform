# Ring Model Contract

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR Improve Hub 的 ring-based 渐进部署机制和 ring promotion criteria，对应 ADR-075 §33 和设计文档 §9。
> **更新日期**：2026-04-29

## 1. Scope

本 contract defines六级受控发布（L0-L5）的 ring 模型、ring promotion criteria 和渐进式部署策略。

Related documents:

- `release_rollout_and_rollback_contract.md`
- [ADR-075 六级受控发布](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 2. Ring Model Overview

Ring Model 提供渐进式部署机制，via分级流量分配和 promotion criteria 控制来降低生产风险。

### 2.1 Ring Levels

| Ring | Name | Traffic | AI 自主permission | 人class审批 | 典型场景 |
|------|------|---------|------------|---------|---------|
| Ring 0 | `off` | 0% | no操作permission，onlyrecord | — | disabled发布 |
| Ring 1 | `evaluate_0` | 0%（onlyrecord） | candidate evaluation / evidence validation | — | 候选评估 |
| Ring 2 | `canary_5` | 5% | 参数调整、策略选择 | critical/high 需审批 | 小规模验证 |
| Ring 3 | `partial_25` | 25% | configureRecommendation | 全部需审批 | 扩大验证 |
| Ring 4 | `stable_75` | 75% | 执linesconfigure变更 | 全部必须审批 | 接近full |
| Ring 5 | `stable_100` | 100% | 完全自主（受 guardrail 约束） | only异常升级 | full发布 |

## 3. Ring Promotion Criteria

### 3.1 Automatic Promotion Requirements

从当前 ring 升级到下一 ring 必须满足以下 criteria：

| 指标 | threshold | 窗口 | Description |
|------|------|------|------|
| 错误率 | < 1% | 连续 5 分钟 | 生产错误率必须低于threshold |
| P99 delay | < 500ms | 连续 5 分钟 | 端到端delay必须低于threshold |
| success率 | > 99% | 连续 5 分钟 | success率必须高于threshold |
| 样本数 | > 100 | 累积 | 最小样本数以确保统计显著性 |

### 3.2 Manual Promotion Approval

对于 critical/high priority 的改进候选，必须获得人class审批才能从 Ring 2 升级到 Ring 3。

### 3.3 Auto-Rollback Criteria

如果以下条件触发，系统自动回滚到上一 ring 或 Ring 1：

| 条件 | threshold | 窗口 | 动作 |
|------|------|------|------|
| 错误率exceeds标 | > 1% | 5 分钟 | L4→L3 |
| P99 delayexceeds标 | > 500ms | 5 分钟 | L4→L3 |
| success率不达标 | < 99% | 5 分钟 | L4→L3 |
| 连续failediterations数 | > 10 | 10 分钟 | directly回滚 L1 |
| 资源耗尽 | Memory > 90% | 1 分钟 | directly回滚 L1 |

## 4. Ring Interface

### 4.1 RingStatus

```typescript
type RingStatus =
  | "off"           // Ring 0 - disabled
  | "evaluate_0"   // Ring 1 - only评估
  | "canary_5"      // Ring 2 - 5% 流量
  | "partial_25"    // Ring 3 - 25% 流量
  | "stable_75"     // Ring 4 - 75% 流量
  | "stable_100";   // Ring 5 - full
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
  ↓ (人工enabled)
evaluate_0 (R1)
  ↓ (自动：满足 criteria)
canary_5 (R2)
  ↓ (自动：满足 criteria + 人class审批 for critical/high)
partial_25 (R3)
  ↓ (自动：满足 criteria)
stable_75 (R4)
  ↓ (自动：满足 criteria)
stable_100 (R5)
  ↓ (持续 M 天noIssue)
released
```

### 5.2 Rollback Transitions

任意 ring 均可回滚到任意更低 ring，回滚来源：
- 自动回滚（指标触发）
- 人工回滚（操作员Decision）

## 6. Autonomy Boundary per Ring

| Ring | AI 自主permission | 人class审批要求 |
|------|------------|------------|
| R0-R1 | 完全自主（onlyrecord） | 不需要 |
| R2 | 参数调整、策略选择 | 需要 for critical/high |
| R3 | configure变更Recommendation | 需要 for all |
| R4 | 执linesconfigure变更 | 必须 for all |
| R5 | 完全自主（受 guardrail 约束） | only异常升级 |

## 7. Implementation Requirements

### 7.1 Ring Lifecycle Manager

```typescript
interface RingLifecycleManager {
  // 初始化 ring Status
  initializeRing(candidateId: string, initialRing: RingStatus): Promise<void>;

  // request promotion
  requestPromotion(request: RingPromotionRequest): Promise<RingPromotionDecision>;

  // 执lines回滚
  executeRollback(candidateId: string, targetRing: RingStatus, reason: string): Promise<void>;

  // 获取当前 ring Status
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

  // 评估isno满足 promotion criteria
  evaluatePromotionCriteria(metrics: RingMetrics): PromotionCriteriaResult;

  // 评估isno满足 rollback criteria
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

- Ring metrics 必须满足 §33 defines的threshold
- 未满足 criteria 不得 promote
- Auto-rollback 必须在指标exceeds标时触发

## 9. Closure Conclusion

Ring Model 不is简单的百分比分割，而iscontains严格 criteria、自动化 gate 和人class审批点的渐进式部署机制。任何一个 ring 的 promotion 都必须via过明确的 criteria 验证，回滚机制确保Issue可以被及时控制。