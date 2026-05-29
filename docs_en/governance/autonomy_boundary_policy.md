# Autonomy Boundary Policy

> **治理层级**：跨 OAPEFLIR 8 阶段
> **生效日期**：2026-04-17
> **相关 ADR**：[ADR-016 OAPEFLIR 八阶段模型](../adr/016-oapeflir-loop-model.md)，[ADR-075 六级受控发布](../adr/075-controlled-rollout-release.md)

## 1. 目标

defines AI Agent 在 OAPEFLIR 各阶段的自主permission边界，确保：
- AI 不会执linesexceeds出其置信度的操作
- 高风险操作必须有人class审批（HITL）
- 自主permission随 Rollout 级别（L0-L5）dynamically调整

## 2. permission级别defines

| 级别 | 名称 | AI 自主permission | 人class审批要求 |
|------|------|------------|------------|
| **L0** | `off` | no操作permission，onlyrecord | 不需要 |
| **L1** | `shadow` | onlyrecord执lines，不修改Status | 不需要 |
| **L2** | `canary_5` | 参数调整、策略选择 | 需要 for critical/high |
| **L3** | `partial_25` | configure变更Recommendation | 需要 for all |
| **L4** | `stable_75` | 执linesconfigure变更 | 必须 for all |
| **L5** | `stable_100` | 完全自主（受 guardrail 约束） | only异常升级 |

## 3. 阶段permission矩阵

| 阶段 | L0-L1 | L2 | L3 | L4-L5 |
|------|-------|-----|-----|-------|
| **Observe** | 读取信号 | 读取 + 聚合 | 读取 + 聚合 + 过滤 | 完全自主 |
| **Assess** | 评估计算 | 评估 + Recommendation | 评估 + Recommendation + 确认 | 完全自主 |
| **Plan** | 生成草稿 | 生成 + 选择策略 | 生成 + 选择 + 确认 | 完全自主 |
| **Execute** | 读取Status | 执lines + 监控 | 执lines + 调整 + 回滚 | 完全自主 |
| **Feedback** | 收集信号 | 收集 + 预handle | 收集 + 预handle + 关联 | 完全自主 |
| **Learn** | 提取模式 | 提取 + 验证 | 提取 + 验证 + 确认 | 完全自主 |
| **Improve** | 生成候选 | 候选 + guardrail | 候选 + guardrail + 审批 | 完全自主 |
| **Rollout** | 调度record | 调度 L2 | 调度 L3-L4 | 调度 L5 |

## 4. permission边界规则

### 4.1 绝对禁止（任何级别）

```
- 不执lines未via Assess 评估的高风险操作
- 不在黑名单字段（recommendedWorkflow, riskLevel, approvalRequired 等）上做Decision
- 不bypassing Plan DTO directly执lines（必须 R3-NOBYPASS）
- 不在 Learn→Knowledge 集成中references入未验证内容
```

### 4.2 条件禁止

| 条件 | 禁止lines为 | 理由 |
|------|---------|------|
| 置信度 < 0.7 | 执lines L4+ permission操作 | 置信度不足 |
| timebudget > 80% | 发起新的 Improve 候选 | 资源紧张 |
| 连续failed > 3 iterations | 执lines Execute 阶段 | failed累积 |
| user明确拒绝 | 执lines任何变更 | 人class意志优先 |

### 4.3 审批升级路径

```
L2+ 操作被 guardrail 拦截
    → record审批request
    → 发送通知到审批队列
    → 等待人class确认
    → 确认后重试或降级
```

## 5. Autonomy Guardrail

`ImprovementGuardrail` 接口mandatory执linespermission边界：

```typescript
interface ImprovementGuardrail {
  // 评估操作isno在当前自主permission内
  evaluateAutonomyLevel(
    candidate: ImprovementCandidate,
    currentRolloutLevel: RolloutLevel
  ): AutonomyEvaluation;

  // 检查isno需要人class审批
  requiresHumanApproval(
    candidate: ImprovementCandidate,
    targetLevel: RolloutLevel
  ): boolean;
}

interface AutonomyEvaluation {
  allowed: boolean;
  currentLevel: RolloutLevel;
  requiredLevel: RolloutLevel;
  blockingReasons: string[];
  recommendations: string[];
}
```

## 6. 审计要求

所有跨越permission边界的操作必须record：

```typescript
interface AutonomyAuditLog {
  timestamp: string;
  operation: string;
  requestedLevel: RolloutLevel;
  grantedLevel: RolloutLevel;
  actor: 'ai' | 'human';
  reason: string;
  outcome: 'approved' | 'rejected' | 'escalated';
}
```

## 7. 违规handle

| 违规class型 | handle方式 |
|---------|---------|
| bypassing Plan 执lines | 任务立即终止，record `R3-NOBYPASS` 违规 |
| exceeds出 L2 执lines未审批 | 执lines回滚，通知manage员 |
| 违反黑名单字段 | 输出被mandatory过滤，违规被record |
| 置信度 < 0.7 执lines高风险 | 操作暂停，等待人class确认 |

## 8. 相关文档

- [ADR-016 OAPEFLIR 八阶段认知循环模型](../adr/016-oapeflir-loop-model.md)
- [ADR-075 六级受控发布vs Rollout Status机](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)
- [autonomy-boundary-policy.ts](../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/autonomy-boundary-policy.ts)
