# ADR-073: Unified Agent Resource Model

Status: Accepted (phased)
日期: 2026-04-13
更新: 2026-04-16

## Background

`reviews/opeli_detailed_design.md §K` 要求把 OAPEFLIR、反馈学习改进闭环、知识vs记忆references用、artifact vs rollout 证据链统一到一组共享资源模型中。

此前仓库里已via存在：

- `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / events / approvals / artifacts / memories` 等持久化对象
- `FeedbackSignal / LearningObject / ImprovementCandidate / StrategyVersion / RolloutRecord` 等领域对象
- `ArtifactRef / EvidenceRef` 一classreferences用语义

但资源模型仍存在三个Issue：

1. typed ref 不完整，`MemoryRef / KnowledgeRef` 未在统一资源模型中明确。
2. 资源枚举偏旧，尚未把 feedback / learning / improvement / rollout / knowledge / memory layer 纳入同一套 canonical resource family。
3. 旧草案把 `EnvironmentSpec / Session / AgentThread / McpServerSpec` directly写成当前必须交付，容易vs Ring 1 completed范围混淆。

因此本 ADR 需要改写为：先给出当前 authoritative 资源边界，再把 `M2` 目标态扩展单独标注。

## Decision

统一资源模型采用“两层defines”：

1. Ring 1 authoritative resource family：当前仓库vs contract 应统一uses的资源class型、typed ref 和 lineage 边界。
2. Ring 2 / Ring 3 extension resource family：`Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` 完整平台化后的扩展资源，不计入当前完成声明。

## Canonical Typed Ref

所有跨 contract 共享references用统一收敛到 typed ref family：

```ts
type TypedRefId = ArtifactRef | EvidenceRef | MemoryRef | KnowledgeRef;

type ArtifactRef = `artifact:${string}`;
type EvidenceRef = `evidence:${string}`;
type MemoryRef = `memory:${string}`;
type KnowledgeRef = `knowledge:${string}`;
```

约束：

- `ArtifactRef` used for artifact store 中的可预览、可发布、可归档产物。
- `EvidenceRef` used for runbook、approval、audit、readiness 里的证据包、截图、日志摘要、repro bundle。
- `MemoryRef` used for六层记忆中的已持久化条目或晋升record。
- `KnowledgeRef` used for知识命名空间、知识块、知识条目或索references结果。
- contract 中若出现裸 `ref_id`，语义必须可收敛为上述四class之一；不得再uses未区分class型的 free-form string 作为跨边界权威references用。

## Authoritative Resource Family

当前 Ring 1 authoritative 资源家族如下：

| 资源class型 | 当前 canonical 对象 | 最小标识 |
|---|-------|--------|
| `harness_run` | `HarnessRun` / `harness_runs` | `harness_run_id` |
| `plan_graph_bundle` | `PlanGraphBundle` / `plan_graph_bundles` | `plan_graph_bundle_id` |
| `node_run` | `NodeRun` / `node_runs` | `node_run_id` |
| `node_attempt_receipt` | `NodeAttemptReceipt` / `node_attempt_receipts` | `receipt_id` |
| `task_projection` | `TaskRecord` / `tasks` | `task_id` |
| `workflow_projection` | `WorkflowState` / `workflow_state` | `workflow_id` |
| `approval` | `ApprovalRequest` / `approvals` | `approval_id` |
| `event` | typed event / `events` | `event_id` |
| `artifact` | `ArtifactRecord` | `ArtifactRef` |
| `evidence` | diagnostics / repro / report bundle | `EvidenceRef` |
| `memory_entry` | memory item / promotion record | `MemoryRef` |
| `memory_layer` | `L1-L6` memory partition | `memory_layer + MemoryRef` |
| `feedback_signal` | `FeedbackSignal` | `feedback_signal_id` |
| `learning_object` | `LearningObject` | `learning_object_id` |
| `improvement_candidate` | `ImprovementCandidate` | `improvement_candidate_id` |
| `strategy_version` | `StrategyVersion` | `strategy_version_id` |
| `rollout_record` | `RolloutRecord` | `rollout_record_id` |
| `knowledge_entry` | knowledge item / chunk / summary | `KnowledgeRef` |

补充规则：

- `feedback_signal / learning_object / improvement_candidate / strategy_version / rollout_record` is OAPEFLIR 闭环中的一等资源，不再只视为附属日志。
- `memory_layer` is `MemoryEntry` 的治理分区，而不is独立业务对象；但 contract 中允许把 layer promotion 当成独立审计资源。
- `knowledge_entry` 在当前 Ring 1 中允许以最小实现存在，但命名、references用和 lineage 语义必须固定。

## Resource Projection

统一资源模型不is要求当前仓库立刻新增一整套全新table，而is要求所有入口文档、contract 和 API 叙述可以投影到同一组资源语义：

| 资源家族 | 当前常见投影 |
| --- | --- |
| harness_run / plan_graph_bundle / node_run / node_attempt_receipt | `storage_schema_contract.md`、`runtime_execution_contract.md` |
| task_projection / workflow_projection | `task_and_workflow_contract.md`、interaction projection |
| approval / event | `approval_and_hitl_contract.md`、`event_bus_contract.md` |
| artifact / evidence | `artifact_store_contract.md`、`diagnostics_snapshot_and_repro_bundle_contract.md` |
| memory_entry / memory_layer | `memory_decay_and_quality_contract.md`、`context_compaction_and_overflow_contract.md` |
| feedback / learning / improvement / rollout | `task_and_workflow_contract.md`、`state_transition_matrix_contract.md` |
| knowledge_entry | `knowledge` 最小实现、`data_plane_contract.md`、active docs 中的 namespace/ingestion Description |

## Shared Resource Shape

跨资源共享的最小字段应保持一致：

```ts
interface ResourceEnvelope<Id extends string, Kind extends string> {
  id: Id;
  resourceKind: Kind;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  ownerRef?: string;
  traceId?: string;
  artifactRefs?: ArtifactRef[];
  evidenceRefs?: EvidenceRef[];
  relatedRefIds?: TypedRefId[];
}
```

Description：

- 不要求所有table逐字采用同一接口。
- 但所有 contract 应能把核心实体映射为同一组最小治理字段：身份、Status、time、trace、证据references用、关联 typed refs。

## Memory And Knowledge Typed Refs

### `MemoryRef`

`MemoryRef` 最少应能指向：

- 某条 `MemoryEntry`
- 某iterations `memory.layer_promoted` 事件的目标条目
- 某条 `CompactionRecord` 保留或逐出的记忆对象

最小元dataRecommendation：

```ts
interface MemoryRefMetadata {
  memoryRef: MemoryRef;
  layer: "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
  scope: "task" | "session" | "project" | "org";
  freshnessState: "fresh" | "aging" | "stale" | "revoked";
}
```

### `KnowledgeRef`

`KnowledgeRef` 最少应能指向：

- 某个 knowledge namespace 下的条目
- 某个已索references的知识 chunk / summary / retrieval result
- 某个知识来源的 provenance record

最小元dataRecommendation：

```ts
interface KnowledgeRefMetadata {
  knowledgeRef: KnowledgeRef;
  namespace: string;
  trustTier: "authoritative" | "trusted" | "unverified" | "deprecated";
  freshnessState: "fresh" | "aging" | "stale" | "archived";
}
```

## Lineage Principle

统一资源模型必须supported以下 lineage 路径：

`HarnessRun/NodeRun/NodeAttemptReceipt -> FeedbackSignal -> LearningObject -> ImprovementCandidate -> StrategyVersion -> RolloutRecord -> Artifact/Evidence`

同时允许：

`HarnessRun/NodeRun -> MemoryRef`

`HarnessRun/NodeRun -> KnowledgeRef`

约束：

- 改进、发布和审计链路不得丢失上游 feedback / learning 来源。
- `MemoryRef` vs `KnowledgeRef` 可以参vs上下文构建，但不得bypassing审批、分class和 trust tier 边界。
- LLM 可以生成草案内容，但资源Status流转必须由Control Plane更新。

## Phase Boundary

### 当前 Ring 1 authoritative 范围

当前文档体系必须按以下边界叙述：

- `harness_run / plan_graph_bundle / node_run / node_attempt_receipt / approval / event / artifact / evidence / feedback / learning / improvement / rollout / memory / knowledge-minimum` 均belongs to当前已对齐范围。
- `tasks / workflow_state / sessions` 只允许作为 projection / interaction 资源叙述。
- typed ref family 已is当前文档边界的一部分，哪怕底层实现仍存在兼容命名。
- `Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release` 作为顶层循环阶段已is当前 contract canonical 术语。

### `M2` target-state 范围

以下资源保留为 `M2-EXT-01` 目标态，不得在当前 readiness 中table述为已交付：

- 完整 `EnvironmentSpec` 平台化
- 完整 `Session` / `AgentThread` 资源化 API
- 完整 `McpServerSpec` Control Plane化
- 完整 `Knowledge Plane / Artifact Plane / Domain Registry / Plugin SPI Registry`

这些资源可以在 contract 或 ADR 中出现，但必须显式标为 target-state 或 extension-plane，而不is当前 Ring 1 authoritative deliverable。

## vs现有文档的关系

- `storage_schema_contract.md` 负责最小持久化投影，不要求一iterations性建立全部 target-state table。
- `memory_decay_and_quality_contract.md` defines `MemoryRef` 及 `L1-L6` 的质量、晋升和衰减规则。
- `tool_skill_plugin_contract.md` vs `ecosystem_extension_plane_contract.md` 负责 `M2` 扩展资源的 SPI / registry 边界。
- `artifact_unified_model_contract.md` 和 `artifact_store_contract.md` 负责 `ArtifactRef` 的 canonical 模型。

## 结果

采用本 ADR 后，统一资源模型的含义被收敛为：

1. 当前 contract 必须共用同一套 typed ref vs资源家族。
2. Ring 1 completed范围vs Ring 2 / Ring 3 扩展范围被明确分层。
3. 后续新增 API、table结构或诊断对象时，必须优先投影到现有 canonical resource family，而不is再references入新的平lines命名。

## v4.3 ADR Remediation

- A-20: 本 ADR 原先把 `tasks / workflow / execution / ExecutionEnvelope` 写成 authoritative 资源家族，Root cause: 统一资源模型先以历史storage投影对象起草，后续没有随着 `HarnessRun / PlanGraphBundle / NodeRun / NodeAttemptReceipt` 成为 runtime truth synchronous重写。修复：正文现把 canonical 资源主语改为 run/node/graph/receipt，旧 task/workflow/execution only保留为 projection 资源。
- A-29: 本 ADR 原先反复uses `phase1-4` 作为当前完成边界，Root cause: 资源模型 ADR accesses along用了旧排期命名，没有随着主Architecture统一到 `Ring 1 / Ring 2 / Ring 3`。修复：正文现改为 ring 分层术语，旧 phase 名称不再作为 canonical 交付口径。
