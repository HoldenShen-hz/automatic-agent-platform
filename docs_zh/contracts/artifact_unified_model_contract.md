# Artifact Unified Model Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR Artifact Plane 的统一模型，对应 ADR-016 §11。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 统一 `output`、`step output`、`artifact` 三类结果表达，避免文本结果、结构结果和文件产物混用。

相关文档：

- `result_envelope_contract.md`
- `artifact_store_contract.md`
- `task_and_workflow_contract.md`
- [ADR-016 OAPEFLIR 八阶段模型](../adr/016-oapeflir-loop-model.md)

## 2. 目标

- 明确用户可读结果与文件产物不是同一种对象。
- 统一中间结构输出和最终交付物的边界。
- 为 inspect、replay、download、retention 提供统一语义。
- 支持 OAPEFLIR 8 阶段的 artifact 追踪（Plan/Execute/Learn/Improve/Release）。

## 3. 统一对象

- `HumanOutput`: 面向用户展示的结论或摘要
- `StructuredExecutionView`: 基于 `NodeAttemptReceipt` 派生的结构化中间结果视图
- `ArtifactRecord`: 文件、图片、报告、压缩包等物理产物

### 3.1 OAPEFLIR ArtifactPlane 接口

```typescript
interface ArtifactRecord {
  artifactId: string;
  harnessRunId: string;
  nodeRunId?: string;
  planGraphBundleId?: string;
  taskId?: string;          // 查询入口，不是 truth 主键
  executionId?: string;     // legacy projection alias
  type: ArtifactType;
  path: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  refs?: ArtifactRef[];      // 跨阶段引用
  publishStatus: PublishStatus;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface ArtifactRef {
  refId: string;
  targetType: 'feedback' | 'learning' | 'improvement' | 'release' | 'execution';
  targetId: string;
}
```

## v4.3 Contract Remediation

- T-62: 本文原先把 `executionId / planId / StructuredStepOutput` 写成 artifact 主关联键，根因是 artifact contract 直接复用了旧 workflow-step 输出模型，没有切换到 `NodeAttemptReceipt` 和 `PlanGraphBundle` 的执行真相边界。修复：正文现以 `harnessRunId / nodeRunId / planGraphBundleId` 为权威 lineage，旧字段仅保留为查询兼容别名。

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
- `release_evidence`             // OAPEFLIR Release
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

`publishStatus` 生命周期：

- `draft`
- `preview`
- `published`
- `archived`

## 4. 规则

- `HumanOutput` 可引用 artifact，但不能替代 artifact 索引。
- `StructuredStepOutput` 用于后续步骤依赖，不应默认直接暴露给用户。
- `ArtifactRecord` 一律通过索引和权限控制访问，不直接塞进消息主体。
- 跨闭环对象引用 artifact 时，应优先使用 `ArtifactRef`，不得直接内嵌本地路径或 blob。
- Token saving via `ref:artifact:{id}` 应用于 Execute→Feedback 传递，减少 token 消耗（对应设计文档 §11.4）。

## 5. OAPEFLIR Artifact Plane 约束

- Plan artifact 必须能追踪到原始 assessment 和 strategy。
- Execute artifact 必须包含 DualChannelStepOutput 引用。
- Learning artifact 必须包含 evidence 链接（R4-EVIDENCE 约束）。
- Rollout artifact 必须包含 metrics 快照。
- Artifact 10MB bundle 限制和 7 天自动归档规则（§D.7）。

## 6. 收口结论

统一 artifact 模型的关键不是新增对象，而是让”文本结论、结构结果、文件产物”各归其位。
