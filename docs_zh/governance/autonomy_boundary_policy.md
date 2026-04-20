# Autonomy Boundary Policy

> **治理层级**：跨 OAPEFLIR 8 阶段
> **生效日期**：2026-04-17
> **相关 ADR**：[ADR-016 OAPEFLIR 八阶段模型](../adr/016-oapeflir-loop-model.md)，[ADR-075 六级受控发布](../adr/075-controlled-rollout-release.md)

## 1. 目标

定义 AI Agent 在 OAPEFLIR 各阶段的自主权限边界，确保：
- AI 不会执行超出其置信度的操作
- 高风险操作必须有人类审批（HITL）
- 自主权限随 Rollout 级别（L0-L5）动态调整

## 2. 权限级别定义

| 级别 | 名称 | AI 自主权限 | 人类审批要求 |
|------|------|------------|------------|
| **L0** | `off` | 无操作权限，仅记录 | 不需要 |
| **L1** | `shadow` | 仅记录执行，不修改状态 | 不需要 |
| **L2** | `canary_5` | 参数调整、策略选择 | 需要 for critical/high |
| **L3** | `partial_25` | 配置变更建议 | 需要 for all |
| **L4** | `stable_75` | 执行配置变更 | 必须 for all |
| **L5** | `stable_100` | 完全自主（受 guardrail 约束） | 仅异常升级 |

## 3. 阶段权限矩阵

| 阶段 | L0-L1 | L2 | L3 | L4-L5 |
|------|-------|-----|-----|-------|
| **Observe** | 读取信号 | 读取 + 聚合 | 读取 + 聚合 + 过滤 | 完全自主 |
| **Assess** | 评估计算 | 评估 + 建议 | 评估 + 建议 + 确认 | 完全自主 |
| **Plan** | 生成草稿 | 生成 + 选择策略 | 生成 + 选择 + 确认 | 完全自主 |
| **Execute** | 读取状态 | 执行 + 监控 | 执行 + 调整 + 回滚 | 完全自主 |
| **Feedback** | 收集信号 | 收集 + 预处理 | 收集 + 预处理 + 关联 | 完全自主 |
| **Learn** | 提取模式 | 提取 + 验证 | 提取 + 验证 + 确认 | 完全自主 |
| **Improve** | 生成候选 | 候选 + guardrail | 候选 + guardrail + 审批 | 完全自主 |
| **Rollout** | 调度记录 | 调度 L2 | 调度 L3-L4 | 调度 L5 |

## 4. 权限边界规则

### 4.1 绝对禁止（任何级别）

```
- 不执行未经 Assess 评估的高风险操作
- 不在黑名单字段（recommendedWorkflow, riskLevel, approvalRequired 等）上做决策
- 不绕过 Plan DTO 直接执行（必须 R3-NOBYPASS）
- 不在 Learn→Knowledge 集成中引入未验证内容
```

### 4.2 条件禁止

| 条件 | 禁止行为 | 理由 |
|------|---------|------|
| 置信度 < 0.7 | 执行 L4+ 权限操作 | 置信度不足 |
| 时间预算 > 80% | 发起新的 Improve 候选 | 资源紧张 |
| 连续失败 > 3 次 | 执行 Execute 阶段 | 失败累积 |
| 用户明确拒绝 | 执行任何变更 | 人类意志优先 |

### 4.3 审批升级路径

```
L2+ 操作被 guardrail 拦截
    → 记录审批请求
    → 发送通知到审批队列
    → 等待人类确认
    → 确认后重试或降级
```

## 5. Autonomy Guardrail

`ImprovementGuardrail` 接口强制执行权限边界：

```typescript
interface ImprovementGuardrail {
  // 评估操作是否在当前自主权限内
  evaluateAutonomyLevel(
    candidate: ImprovementCandidate,
    currentRolloutLevel: RolloutLevel
  ): AutonomyEvaluation;

  // 检查是否需要人类审批
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

所有跨越权限边界的操作必须记录：

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

## 7. 违规处理

| 违规类型 | 处理方式 |
|---------|---------|
| 绕过 Plan 执行 | 任务立即终止，记录 `R3-NOBYPASS` 违规 |
| 超出 L2 执行未审批 | 执行回滚，通知管理员 |
| 违反黑名单字段 | 输出被强制过滤，违规被记录 |
| 置信度 < 0.7 执行高风险 | 操作暂停，等待人类确认 |

## 8. 相关文档

- [ADR-016 OAPEFLIR 八阶段认知循环模型](../adr/016-oapeflir-loop-model.md)
- [ADR-075 六级受控发布与 Rollout 状态机](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)
- [autonomy-boundary-policy.ts](../../src/platform/orchestration/oapeflir/improve-rollout/autonomy-boundary-policy.ts)
