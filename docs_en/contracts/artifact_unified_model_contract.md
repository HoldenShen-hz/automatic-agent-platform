# Artifact Unified Model Contract

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR Artifact Plane 的统一模型，对应 ADR-016 §11。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 统一 `output`、`step output`、`artifact` 三class结果table达，避免文本结果、结构结果和文件产物混用。

相关文档：

- `result_envelope_contract.md`
- `artifact_store_contract.md`
- `task_and_workflow_contract.md`
- [ADR-016 OAPEFLIR 八阶段模型](../adr/016-oapeflir-loop-model.md)

## 2. 目标

- 明确user可读结果vs文件产物不is同一种对象。
- 统一中间结构输出和最终交付物的边界。
- 为 inspect、replay、download、retention 提供统一语义。
- supported OAPEFLIR 8 阶段的 artifact 追踪（Plan/Execute/Learn/Improve/Rollout）。

## 3. 统一对象

- `HumanOutput`: 面向user展示的Conclusion或摘要
- `StructuredExecutionView`: based on `NodeAttemptReceipt` 派生的结构化中间结果视图
- `ArtifactRecord`: 文件、图片、报告、压缩包等物理产物

### 3.1 OAPEFLIR ArtifactPlane 接口

```typescript
interface ArtifactRecord {
  artifactId: string;
  harnessRunId: string;
  nodeRunId?: string;
  planGraphBundleId?: string;
  taskId?: string;          // 查询入口，不is truth 主键
  executionId?: string;     // legacy projection alias
  type: ArtifactType;
  path: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  refs?: ArtifactRef[];      // 跨阶段references用
  publishStatus: PublishStatus;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface ArtifactRef {
  refId: string;
  targetType: 'feedback' | 'learning' | 'improvement' | 'rollout' | 'execution';
  targetId: string;
}
```

## v4.3 Contract Remediation

- T-62: 本文原先把 `executionId / planId / StructuredStepOutput` 写成 artifact 主关联键，Root cause:  artifact contract directly复用了旧 workflow-step 输出模型，没有切换到 `NodeAttemptReceipt` 和 `PlanGraphBundle` 的执lines真相边界。修复：正文现以 `harnessRunId / nodeRunId / planGraphBundleId` 为权威 lineage，旧字段only保留为查询兼容别名。

### 3.2 ArtifactType 扩展

`ArtifactType` 当前至少应覆盖：

- `report`
- `evidence_bundle`
- `timeline_export`
- `diagnostic_bundle`
- `workflow_checkpoint`
- `feedback_snapshot`
- `learning_object_bundle`         // OAPEFLIR Learn Hub
- `improvement_candidate_bundle`  // OAPEFLIR Improve Hub
- `rollout_evidence`             // OAPEFLIR Rollout
- `policy_explain_export`
- `plan_dag_export`              // OAPEFLIR Plan Hub
- `execution_output`             // OAPEFLIR Execute Hub

`BundleType` 当前至少应覆盖：

- `task_result`
- `incident`
- `promotion_evidence`
- `release_evidence`
- `learning_pattern_bundle`     // OAPEFLIR Learn Hub
- `canary_metrics`              // OAPEFLIR Rollout

`publishStatus` 生命cycle：

- `draft`
- `preview`
- `published`
- `archived`

## 4. 规则

- `HumanOutput` 可references用 artifact，但不能替代 artifact 索references。
- `StructuredStepOutput` used for后续步骤relies on，不应defaults todirectly暴露给user。
- `ArtifactRecord` 一律via索references和permission控制访问，不directly塞进消息主体。
- 跨闭环对象references用 artifact 时，应优先uses `ArtifactRef`，不得directly内嵌本地路径或 blob。
- Token saving via `ref:artifact:{id}` 应used for Execute→Feedback 传递，减少 token 消耗（对应设计文档 §11.4）。

## 5. OAPEFLIR Artifact Plane 约束

- Plan artifact 必须能追踪到原始 assessment 和 strategy。
- Execute artifact 必须contains DualChannelStepOutput references用。
- Learning artifact 必须contains evidence 链接（R4-EVIDENCE 约束）。
- Rollout artifact 必须contains metrics 快照。
- Artifact 10MB bundle 限制和 7 天自动归档规则（§D.7）。

## 6. 收口Conclusion

统一 artifact 模型的关键不is新增对象，而is让”文本Conclusion、结构结果、文件产物”各归其位。
