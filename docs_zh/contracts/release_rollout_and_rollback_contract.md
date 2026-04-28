# Release Rollout And Rollback Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR Improve Hub 的受控发布与回滚机制，对应 ADR-075 和 ADR-018。
> **更新日期**：2026-04-17

## 1. Scope

This contract defines industrial-grade release, canary, rollback, and schema compatibility strategies for the OAPEFLIR Improve/Rollout pipeline.

Related documents:

- `runtime_repository_and_migration_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_operations_plane_contract.md`
- [ADR-075 六级受控发布](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 2. Goals

- Unify release paths for code, config, prompt, role, skill.
- Make any production release have controllable canary and executable rollback.
- Make schema changes comply with forward/backward compatibility.
- Integrate with OAPEFLIR LearningObject → ImprovementCandidate → RolloutRecord pipeline.

## 3. Release Objects

- `application_binary`
- `config_bundle`
- `prompt_bundle`
- `policy_bundle`
- `role_bundle`
- `skill_bundle`
- `schema_migration`
- `LearningObject`（对应 OAPEFLIR 副链）

## 4. Release Levels and RolloutStatus

### 4.1 六级受控发布（L0-L5）

对应 ADR-075 §1：

| Level | Name | Traffic | AI 自主权限 | 人类审批 |
| --- | --- | --- | --- | --- |
| L0 | `off` | 0% | 无操作权限，仅记录 | — |
| L1 | `evaluate_0` | 0%（仅记录） | candidate evaluation / evidence validation | — |
| L2 | `canary_5` | 5% | 参数调整、策略选择 | critical/high 需审批 |
| L3 | `partial_25` | 25% | 配置建议 | 全部需审批 |
| L4 | `stable_75` | 75% | 执行配置变更 | 全部必须审批 |
| L5 | `stable_100` | 100% | 完全自主（受 guardrail 约束） | 仅异常升级 |

### 4.2 Rollout 状态机

完整状态机（见 ADR-018 和 ADR-075 §2）：

```
candidate_created
      ↓
under_review （人类审批）
      ↓
approved / rejected
      ↓
evaluation_enabled (L1)
      ↓
canary_5 (L2) ←→ auto_rollback
      ↓
partial_25 (L3) ←→ auto_rollback
      ↓
stable_75 (L4) ←→ auto_rollback
      ↓
stable_100 (L5)
      ↓
released （持续 M 天无问题）
```

### 4.3 Release Modes（补充）

| Mode | Use Case |
| --- | --- |
| `blue_green` | Main chain major version, need quick full-group switch |
| `canary` | Small traffic validation |
| `tenant_gray` | Designated tenant or division phased canary |
| `feature_flag` | Feature enable/disable and quick damage control |

### 4.4 自动回滚条件

对应 ADR-075 §3.2：

| 指标 | 阈值 | 窗口 | 触发动作 |
|------|------|------|---------|
| 错误率 | > 1% | 5 分钟 | L4→L3 |
| P99 延迟 | > 500ms | 5 分钟 | L4→L3 |
| 成功率 | < 99% | 5 分钟 | L4→L3 |
| 连续失败 | > 10 次 | 10 分钟 | 直接回滚 L1 |
| 资源耗尽 | Memory > 90% | 1 分钟 | 直接回滚 L1 |

### 4.5 状态约束

- `evaluate_0`（L1）：候选评估和证据验证，不得直接覆盖用户可见结果。
- `canary_5`（L2）/ `partial_25`（L3）/ `stable_75`（L4）：需通过 metrics gate 方可升级。
- `stable_100`（L5）：全量流量，完全自主（受 guardrail 约束）。
- `auto_rollback`：自动或手动回滚。

## 5. OAPEFLIR 副链集成

```
LearningObject(validated/promoted)
    → ImprovementCandidate(candidate_created)
    → under_review
    → approved / rejected
    → RolloutRecord(evaluate_0 → canary → partial → stable → released)
```

**必须满足的条件**（R4-EVIDENCE 约束）：
- LearningObject without evidence chain must not enter rollout.
- Candidate not passing guardrail can only stay in candidate_created state, must not enter `evaluation_enabled`.
- `evaluation_enabled` runtime should record guardrail reason codes for explainability and audit.

## 6. ImprovementCandidate 接口

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

type RolloutLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
```

## 7. RolloutRecord 接口

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

interface RolloutMetrics {
  errorRate: number;
  latencyP99: number;
  successRate: number;
  sampleCount: number;
}
```

## 8. Rollback 规则

- Code rollback must be faster than data repair.
- prompt / policy / feature flag should support independent rollback.
- Schema rollback if irreversible, must declare in advance and prepare compensating migration.
- Rollback action must produce logs, audit, and incident records.
- If local workspace file modification is involved, allow using shadow snapshot / shadow git repo outside workspace as step-level undo / redo basis; but must not leak git state into user workspace.
- Shadow snapshot should at least support: one stable snapshot per operation, common generation directory exclusion, oversized directory protection, and do not pollute user repository on failure.
- Policy rollback must not be executed purely based on model suggestion; must be decided and recorded by system layer guardrail / policy code.

## 9. Required Capabilities

- Release batch ID
- Release object version
- Canary target scope
- One-click rollback entry
- Rollback prerequisite check
- Post-release health validation
- `config_bundle_ref / registry_credential_ref / deployment_credential_ref` injection plan

## 10. Schema Compatibility Matrix

Industrial-grade schema changes must first comply with:

1. Add before use
2. Be compatible before switching
3. Forward first, then clean up

Not allowed:

- Directly delete columns being depended on by old versions
- Simultaneously launch "new code depends on new column" with no compatibility window
- Bundle irreversible data conversion and application logic switching into one step

## 11. Production Prerequisites

- Has health validation step
- Has tenant gray strategy
- Has rollback owner
- Has schema compatibility checklist
- Has machine-readable secret/config injection plan, and workflow only consumes ref, not plaintext secret

## 12. Autonomy Boundary

对应 governance/autonomy_boundary_policy.md：

| 级别 | AI 自主权限 | 人类审批要求 |
|------|------------|------------|
| L0-L1 | 完全自主（仅记录） | 不需要 |
| L2 | 参数调整、策略选择 | 需要 for critical/high |
| L3 | 配置变更建议 | 需要 for all |
| L4 | 执行配置变更 | 必须 for all |
| L5 | 完全自主（受 guardrail 约束） | 仅异常升级 |

## 13. Closure Conclusion

Industrial-grade release is not "can deploy", but "can canary, can validate, can rollback, can review".
