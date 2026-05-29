# Rollout Release Policy

---

## OAPEFLIR 关联

本治理文档规范 OAPEFLIR 八阶段认知循环中的以下内容：

- **Observe**：信号采集vs治理边界
- **Assess**：执lines评估vspermission治理
- **Plan**：规划约束vs R3 硬约束
- **Execute**：执linespermissionvssecurity边界
- **Feedback**：反馈信号治理vs分class
- **Learn**：学习内容验证vs推广边界
- **Improve**：改进候选审批vs Rollout 治理
- **Release**：发布permissionvs自动回滚规则

---

> **治理层级**：Improve Hub / Rollout
> **生效日期**：2026-04-17
> **相关 ADR**：[ADR-075 六级受控发布](../adr/075-controlled-rollout-release.md)，[ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 1. 目标

defines ImprovementCandidate 从创建到生产发布的完整生命cycle治理规则，确保：
- 渐进式发布有明确的阶段门槛
- 自动回滚有可度量的触发条件
- Rollout Status转换有完整的审计日志
- 人class审批在关键节点介入

## 2. 6 级发布defines

详见 [ADR-075 六级受控发布](../adr/075-controlled-rollout-release.md)。

| 级别 | 流量 | 自主permission | 审批要求 |
|------|------|---------|---------|
| L0 | 0% | no | — |
| L1 | 0%（record） | shadow | — |
| L2 | 5% | 参数调整 | critical/high 需审批 |
| L3 | 25% | configureRecommendation | 全部需审批 |
| L4 | 75% | configure变更 | 全部必须审批 |
| L5 | 100% | 完全自主 | only异常升级 |

## 3. 阶段转换规则

### 3.1 升级条件

| 从 | 到 | 必要条件 | 最少持续time |
|----|-----|---------|------------|
| L1 | L2 | 指标达标 | 10 分钟 |
| L2 | L3 | no回滚触发 | 30 分钟 |
| L3 | L4 | success率 > 99% | 60 分钟 |
| L4 | L5 | 稳定运lines | 24 小时 |

### 3.2 自动回滚条件

| 指标 | threshold | 窗口 | 触发动作 |
|------|------|------|---------|
| 错误率 | > 1% | 5 分钟 | L4→L3 |
| P99 delay | > 500ms | 5 分钟 | L4→L3 |
| success率 | < 99% | 5 分钟 | L4→L3 |
| 连续failed | > 10 iterations | 10 分钟 | directly回滚 L1 |
| 资源耗尽 | Memory > 90% | 1 分钟 | directly回滚 L1 |

## 4. ImprovementCandidate 生命cycle

```
candidate_created
      ↓
under_review （人class审批）
      ↓
approved / rejected
      ↓
shadow_enabled (L1)
      ↓
canary_5 (L2) ←→ auto_rollback
      ↓
partial_25 (L3) ←→ auto_rollback
      ↓
stable_75 (L4) ←→ auto_rollback
      ↓
stable_100 (L5)
      ↓
released （持续 M 天noIssue）
```

### 4.1 StatusDescription

| Status | Description | 可执lines操作 |
|------|------|----------|
| `candidate_created` | 新建候选 | submit_for_review |
| `under_review` | 等待人class审批 | approve / reject |
| `approved` | 审批via | enable_shadow |
| `rejected` | 审批拒绝 | — |
| `shadow_enabled` | Shadow 模式运lines | promote |
| `canary_5` | 5% 流量验证 | promote / rollback |
| `partial_25` | 25% 流量验证 | promote / rollback |
| `stable_75` | 75% 流量验证 | promote / rollback |
| `stable_100` | full发布 | release |
| `released` | 正式发布完成 | — |
| `auto_rollback` | 自动回滚中 | — |
| `rolled_back` | 已回滚 | resubmit |

## 5. RolloutScheduler 治理

```typescript
interface RolloutScheduler {
  // 调度升级（满足time条件后自动触发）
  schedulePromotion(
    candidateId: string,
    targetLevel: RolloutLevel,
    scheduledAt: string
  ): void;

  // 调度回滚
  scheduleRollback(
    candidateId: string,
    reason: RollbackReason,
    targetLevel: RolloutLevel
  ): void;

  // 获取活跃的 Rollout
  getActiveRollouts(): RolloutRecord[];

  // 获取 Rollout 历史
  getRolloutHistory(candidateId: string): RolloutRecord[];
}
```

## 6. 审计要求

### 6.1 必须record的 Rollout 事件

| 事件 | record内容 |
|------|---------|
| `improvement:candidate_created` | candidateId, learningObjectId, priority |
| `improvement:under_review` | candidateId, submittedBy |
| `improvement:approved` | candidateId, approvedBy, conditions |
| `improvement:rejected` | candidateId, rejectedBy, reason |
| `improvement:promoted` | candidateId, fromLevel, toLevel, duration |
| `improvement:auto_rollback` | candidateId, trigger, fromLevel, toLevel |
| `improvement:released` | candidateId, totalDuration, finalMetrics |

### 6.2 RolloutRecord 必填字段

```typescript
interface RolloutRecord {
  recordId: string;
  candidateId: string;
  fromLevel: RolloutLevel;
  toLevel: RolloutLevel;
  triggeredBy: 'scheduler' | 'human' | 'auto_rollback';
  triggerReason?: string;
  metrics: RolloutMetrics;
  auditContext: AuditContext;
  createdAt: string;
}
```

## 7. 回滚治理

### 7.1 自动回滚流程

```
指标exceeds标检测
    ↓
RolloutScheduler.scheduleRollback()
    ↓
发送 notification 事件
    ↓
执lines回滚到上一稳定级别
    ↓
record auto_rollback 事件
    ↓
等待人class审查（48 小时内确认）
```

### 7.2 人class介入条件

| 场景 | isno需要人class确认 |
|------|----------------|
| 自动回滚 L2→L1 | optional（自动恢复） |
| 自动回滚 L3→L2 | Recommendation审查 |
| 自动回滚 L4→L3 | 必须审查 |
| 自动回滚 L5→L4 | 必须审查 + 批准后才能重新升级 |
| 连续 3 iterations回滚同一候选 | 禁止自动升级，必须人工审批 |

## 8. 容量vs资源限制

| 指标 | 限制 |
|------|------|
| 同一time活跃的 Rollout | ≤ 10 |
| 单个候选最大回滚iterations数 | 3 |
| 回滚后重新升级等待time | 24 小时 |
| L4 持续timeupper limit | 7 天 |
| 每日新增候选upper limit | 50 |

## 9. 相关文档

- [ADR-075 六级受控发布vs Rollout Status机](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)
- [autonomy_boundary_policy.md](./autonomy_boundary_policy.md)
- [rollout-state-machine.ts](../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/rollout/rollout-state-machine.ts)
- [auto-rollback-service.ts](../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/auto-rollback-service.ts)
