# ADR-075 六级受控发布与 Rollout 状态机

- 状态：Accepted
- 决策日期：2026-04-17
- 相关：ADR-016 OAPEFLIR 八阶段认知循环模型，ADR-018 Rollout 11 状态机

## 背景

OAPEFLIR Improve Hub 负责从 LearningObject 生成 ImprovementCandidate，并通过受控发布流程将改进推广到生产环境。设计要求支持 6 级受控发布（L0-L5），实现 canary/staged/stable 多阶段升级，并在指标不达标时自动回滚。

现有 `rollout-state-machine.ts`（119 行）已实现 canary→partial→stable 的状态转换，本 ADR 正式确立完整的 Rollout 架构。

## 决策

### 1. 6 级受控发布（L0-L5）

| 级别 | 名称 | 流量比例 | 适用场景 |
|------|------|---------|---------|
| **L0** | `off` | 0% | 改进已禁用 |
| **L1** | `evaluate_0` | 0%（仅记录） | 候选评估与证据验证，不影响生产 |
| **L2** | `canary_5` | 5% | 小规模验证，最初级 |
| **L3** | `partial_25` | 25% | 扩大验证，中级 |
| **L4** | `stable_75` | 75% | 接近全量，高级 |
| **L5** | `stable_100` | 100% | 完全发布 |

### 2. Rollout 状态机

```
candidate_created
      ↓
evaluation_enabled (L1)
      ↓ (metrics meet threshold)
canary_5 (L2)
      ↓ (持续 N 分钟无回滚触发)
partial_25 (L3)
      ↓ (持续 N 分钟无回滚触发)
stable_75 (L4)
      ↓ (持续 N 分钟无回滚触发)
stable_100 (L5) ←→ auto_rollback ←→ (触发回滚条件)
      ↓
released (已稳定运行 M 天)
```

### 3. 状态转换规则

```typescript
interface RolloutStateTransition {
  from: RolloutState;
  to: RolloutState;
  condition: RolloutCondition;
  duration: number;      // 最少持续时间（分钟）
  autorollback?: AutoRollbackCondition;
}

interface RolloutCondition {
  errorRateThreshold: number;      // e.g., 0.01 (1%)
  latencyP99Threshold: number;     // e.g., 500 (ms)
  successRateThreshold: number;    // e.g., 0.99 (99%)
}
```

### 4. AutoRollback 触发条件

| 条件 | 阈值 | 窗口 |
|------|------|------|
| 错误率超标 | > 1% | 5 分钟 |
| P99 延迟超标 | > 500ms | 5 分钟 |
| 成功率不达标 | < 99% | 5 分钟 |
| 连续失败次数 | > 10 | 10 分钟 |
| 资源耗尽 | Memory > 90% | 1 分钟 |

### 5. ImprovementCandidate 生命周期

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

#### ImprovementCandidate 状态机转换图

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
      │                  ↓ (持续 N 分钟无回滚)
      │              partial_25 (L3)
      │                  │
      │                  ↓ (持续 N 分钟无回滚)
      │              stable_75 (L4)
      │                  │
      │                  ↓ (持续 N 分钟无回滚)
      │              stable_100 (L5)
      │                  │
      │                  ↓ (稳定运行 M 天)
      │              released
      │
      │ 任何阶段指标超标
      ↓              ←── auto_rollback
auto_rollback → rolled_back

约束：
- `candidate_created` 为初态，`rejected` / `rolled_back` 为终态
- `quarantined` 表示候选因 guardrail、evidence 缺口或回归风险被临时冻结，解除前不得进入 rollout 级别。
- `auto_rollback` 触发后只允许流转到 `rolled_back`，不允许直接恢复
- `released` 后若发现严重问题，需走变更委员会流程方可回退
```

### 6. Autonomy Boundary（自主边界）

| 级别 | AI 自主权限 | 人类审批 |
|------|------------|---------|
| L0-L1 | 完全自主（仅记录） | 不需要 |
| L2-L3 | 参数调整、策略选择 | 需要 for critical/high |
| L4-L5 | 配置变更 | 必须 for all |

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

### 方案 A：仅 off/suggest/shadow（Ring 1 简化版）

优点：实现简单，风险低。
代价：无法实现渐进式发布，收益有限。

### 方案 B：6 级受控发布（已选）

优点：完整的渐进式发布能力，支持自动回滚。
代价：实现复杂度较高（~500 行代码 + 监控集成）。

## 后果

- `rollout-state-machine.ts` 作为状态转换核心。
- `rollout-scheduler.ts` 负责调度 Promotion/Rollback 事件。
- `auto-rollback-service.ts` 监控指标并触发回滚。
- `guardrail-evaluator.ts` 评估改进候选是否符合安全边界。
- `autonomy-boundary-policy.ts` 决定 AI 自主权限。
- 事件：`improvement:candidate_created`、`improvement:promoted`、`improvement:auto_rollback`

## 交叉引用

- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 状态机](./018-rollout-eleven-state-machine.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/core/improvement/` 模块

## 来源章节

- `§9` Improve Hub 设计
- `§9.1` 6 级 controlled release
- `§9.2-9.9` ImprovementCandidate 各接口
- `§L.8` R4-RELEASE 约束

## v4.3 ADR Remediation

- A-35: 本 ADR 原先把 `L1` 级别直接命名为 `shadow`，并把 `shadow_enabled` 同时当作 rollout status 使用，根因是 release level 与 rollout status 两个维度被混成一个命名体系，继续继承了 ADR-018 的历史 shadow 话语。修复：正文现把 `L1` 级别改为 `evaluate_0`，状态改为 `evaluation_enabled`，从而把 level 和 status 清晰拆开，避免级别编号与旧 shadow 语义冲突。
- R3-63: 本 ADR 原先定义 `ImprovementCandidateStatus` 为 12 态，根因是状态机设计时未收敛到 canonical 简化模型。修复：正文现将状态机简化为 4 态核心（candidate_created/under_review/released/rolled_back），其余中间状态归入 rollout level 维度。
