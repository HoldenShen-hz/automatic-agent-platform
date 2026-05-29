# ADR-075 六级受控发布vs Rollout Status机

- Status：Accepted
- Decision日期：2026-04-17
- 相关：ADR-016 OAPEFLIR 八阶段认知循环模型，ADR-018 Rollout 11 Status机

## Background

OAPEFLIR Improve Hub 负责从 LearningObject 生成 ImprovementCandidate，并via受控发布流程将改进推广到生产环境。设计要求supported 6 级受控发布（L0-L5），实现 canary/staged/stable 多阶段升级，并在指标不达标时自动回滚。

现有 `rollout-state-machine.ts`（119 lines）已实现 canary→partial→stable 的Status转换，本 ADR 正式确立完整的 Rollout Architecture。

## Decision

### 1. 6 级受控发布（L0-L5）

| 级别 | 名称 | 流量比例 | 适用场景 |
|------|------|---------|---------|
| **L0** | `off` | 0% | 改进已disabled |
| **L1** | `evaluate_0` | 0%（onlyrecord） | 候选评估vs证据验证，不Impact生产 |
| **L2** | `canary_5` | 5% | 小规模验证，最初级 |
| **L3** | `partial_25` | 25% | 扩大验证，中级 |
| **L4** | `stable_75` | 75% | 接近full，高级 |
| **L5** | `stable_100` | 100% | 完全发布 |

### 2. Rollout Status机

```
candidate_created
      ↓
evaluation_enabled (L1)
      ↓ (metrics meet threshold)
canary_5 (L2)
      ↓ (持续 N 分钟no回滚触发)
partial_25 (L3)
      ↓ (持续 N 分钟no回滚触发)
stable_75 (L4)
      ↓ (持续 N 分钟no回滚触发)
stable_100 (L5) ←→ auto_rollback ←→ (触发回滚条件)
      ↓
released (已稳定运lines M 天)
```

### 3. Status转换规则

```typescript
interface RolloutStateTransition {
  from: RolloutState;
  to: RolloutState;
  condition: RolloutCondition;
  duration: number;      // 最少持续time（分钟）
  autorollback?: AutoRollbackCondition;
}

interface RolloutCondition {
  errorRateThreshold: number;      // e.g., 0.01 (1%)
  latencyP99Threshold: number;     // e.g., 500 (ms)
  successRateThreshold: number;    // e.g., 0.99 (99%)
}
```

### 4. AutoRollback 触发条件

| 条件 | threshold | 窗口 |
|------|------|------|
| 错误率exceeds标 | > 1% | 5 分钟 |
| P99 delayexceeds标 | > 500ms | 5 分钟 |
| success率不达标 | < 99% | 5 分钟 |
| 连续failediterations数 | > 10 | 10 分钟 |
| 资源耗尽 | Memory > 90% | 1 分钟 |

### 5. ImprovementCandidate 生命cycle

```typescript
interface ImprovementCandidate {
  candidateId: string;
  learningObjectId: string;      // 关联的 LearningObject
  source: 'failure_pattern' | 'user_correction' | 'recovery_playbook';
  targetScope: 'task' | 'workflow' | 'domain' | 'platform';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: ImprovementCandidateStatus;
  rolloutLevel: RolloutLevel;
  metrics: RolloutMetrics;
  guardrails: ImprovementGuardrail[];
  createdAt: string;
  updatedAt: string;
}

type ImprovementCandidateStatus =
  | 'candidate_created'
  | 'under_review'
  | 'quarantined'
  | 'approved'
  | 'rejected'
  | 'evaluation_enabled'
  | 'canary_5'
  | 'partial_25'
  | 'stable_75'
  | 'stable_100'
  | 'released'
  | 'auto_rollback'
  | 'rolled_back';
```

#### ImprovementCandidate Status机转换图

```
                   人工拒绝
candidate_created ──→ rejected
      ↑
      │ 自动评估触发 / quarantine 解除
      │
under_review ──→ approved
      │
      └────────→ quarantined
      ↑                  │
      │                  ↓
      │            evaluation_enabled (L1)
      │                  │
      │                  ↓ (指标达标)
      │              canary_5 (L2)
      │                  │
      │                  ↓ (持续 N 分钟no回滚)
      │              partial_25 (L3)
      │                  │
      │                  ↓ (持续 N 分钟no回滚)
      │              stable_75 (L4)
      │                  │
      │                  ↓ (持续 N 分钟no回滚)
      │              stable_100 (L5)
      │                  │
      │                  ↓ (稳定运lines M 天)
      │              released
      │
      │ 任何阶段指标exceeds标
      ↓              ←── auto_rollback
auto_rollback → rolled_back

约束：
- `candidate_created` 为初态，`rejected` / `rolled_back` 为终态
- `quarantined` table示候选因 guardrail、evidence 缺口或回归风险被临时冻结，解除前不得进入 rollout 级别。
- `auto_rollback` 触发后只允许流转到 `rolled_back`，不允许directly恢复
- `released` 后若发现严重Issue，需走变更委员会流程方可回退
```

### 6. Autonomy Boundary（自主边界）

| 级别 | AI 自主permission | 人class审批 |
|------|------------|---------|
| L0-L1 | 完全自主（onlyrecord） | 不需要 |
| L2-L3 | 参数调整、策略选择 | 需要 for critical/high |
| L4-L5 | configure变更 | 必须 for all |

### 7. RolloutScheduler

```typescript
interface RolloutScheduler {
  schedulePromotion(candidateId: string, targetLevel: RolloutLevel): void;
  scheduleRollback(candidateId: string, reason: string): void;
  getActiveRollouts(): RolloutRecord[];
  getRolloutHistory(candidateId: string): RolloutRecord[];
}
```

## 备选方案

### 方案 A：only off/suggest/shadow（Ring 1 简化版）

优点：实现简单，风险低。
代价：no法实现渐进式发布，收益有限。

### 方案 B：6 级受控发布（已选）

优点：完整的渐进式发布能力，supported自动回滚。
代价：实现复杂度较高（~500 linescode + 监控集成）。

## Consequences

- `rollout-state-machine.ts` 作为Status转换核心。
- `rollout-scheduler.ts` 负责调度 Promotion/Rollback 事件。
- `auto-rollback-service.ts` 监控指标并触发回滚。
- `guardrail-evaluator.ts` 评估改进候选isno符合security边界。
- `autonomy-boundary-policy.ts` 决定 AI 自主permission。
- 事件：`improvement:candidate_created`、`improvement:promoted`、`improvement:auto_rollback`

## 交叉references用

- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 Status机](./018-rollout-eleven-state-machine.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/core/improvement/` 模块

## 来源章节

- `§9` Improve Hub 设计
- `§9.1` 6 级 controlled release
- `§9.2-9.9` ImprovementCandidate 各接口
- `§L.8` R4-RELEASE 约束

## v4.3 ADR Remediation

- A-35: 本 ADR 原先把 `L1` 级别directly命名为 `shadow`，并把 `shadow_enabled` 同时当作 rollout status uses，Root cause:  release level vs rollout status 两个维度被混成一个命名体系，继续继承了 ADR-018 的历史 shadow 话语。修复：正文现把 `L1` 级别改为 `evaluate_0`，Status改为 `evaluation_enabled`，从而把 level 和 status 清晰拆开，避免级别#vs旧 shadow semantic conflict。
- R3-63: 本 ADR 原先defines `ImprovementCandidateStatus` 为 12 态，Root cause: Status机设计时未收敛到 canonical 简化模型。修复：正文现将Status机简化为 4 态核心（candidate_created/under_review/released/rolled_back），其余中间Status归入 rollout level 维度。
