# Typed Event Bus Contract

## 1. 范围

本 contract 定义类型化事件总线的上层要求，用于把当前事件注册与 payload schema 进一步冻结到强类型边界。

相关文档：

- `event_bus_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 2. 目标

- 让 event type、payload schema、producer、consumer 形成一一对应关系。
- 降低宽泛 union 和手工 payload 带来的实现漂移。
- 为代码生成、lint 和回放工具提供统一事件定义源。

## 3. 类型模型

每个事件定义至少包含：

- `event_type`
- `tier`
- `payload_schema_ref`
- `payload_type_name`
- `stage?`
- `producer`
- `consumers`
- `compatibility_policy`
- `derivedFromEventId?`

要求：

- 所有 OAPEFLIR hub 事件必须同时拥有 schema ref 和稳定的 TypeScript payload type name。
- `stage` 若存在，必须来自 canonical OAPEFLIR stage 枚举，而不是消费方自定义标签。
- 若事件由其他事实事件、rationale 事件或 replay 过程派生，必须显式声明 `derivedFromEventId`。
- **v4.3 强制规则**：OAPEFLIR 事件 payload 必须使用 `harnessRunId`、`nodeRunId`、`planGraphId` 作为运行链锚点；禁止使用废弃的 `task_id`、`workflow_id`、`execution_id` 作为主键字段。

## 3A. OAPEFLIR Event Payload Types

Phase 1-4 闭环事件必须提供类型化 payload，对应 ADR-079 和 ADR-080。**所有 payload 必须使用 canonical 运行链标识**：`harnessRunId` / `nodeRunId` / `planGraphId`。

### 3A.1 Observe Hub 事件

`ObserveSignalsCollectedPayload`

- `harnessRunId` — canonical 运行链锚点
- `nodeRunId?` — 可选节点标识
- `planGraphId?` — 可选计划图标识
- `loopIteration` — 第几轮循环
- `signalCount` — 信号数量
- `sourceRefs` — 来源引用列表
- `traceId` — 链路追踪 ID

`UnifiedObservationCreatedPayload`

- `harnessRunId` — canonical 运行链锚点
- `observationId` — 观察记录 ID
- `situationSnapshot` — 情境快照
- `metrics` — 指标数据
- `traceId` — 链路追踪 ID
- `nodeRunId?` — 可选节点标识
- `planGraphId?` — 可选计划图标识

### 3A.2 Assess Hub 事件

`AssessmentCompletedPayload`

- `harnessRunId` — canonical 运行链锚点
- `assessmentId` — 评估 ID
- `complexity` — 复杂度级别
- `riskLevel` — 风险级别
- `confidence` — 置信度
- `traceId` — 链路追踪 ID
- `nodeRunId?` — 可选节点标识

### 3A.3 Plan Hub 事件

`PlanCreatedPayload` — **图结构取代线性步骤**

- `harnessRunId` — canonical 运行链锚点
- `planGraphId` — **canonical** PlanGraph 标识（原 plan_id）
- `planVersion` — 计划版本（原 version）
- `strategy` — 规划策略
- `nodeCount` — 图节点数量（取代 `step_count`）
- `edgeCount` — 图边数量
- `traceId` — 链路追踪 ID
- `loopIteration?` — 循环轮次

**规则**：`step_count` 已废弃。PlanCreatedPayload 必须使用 `nodeCount` + `edgeCount` 表示图结构，反映 `PlanGraph` 的 graph-based 语义。

`ReplanTriggeredPayload`

- `harnessRunId` — canonical 运行链锚点
- `planGraphId` — 计划图 ID（原 plan_id）
- `baseGraphVersion` — 基准图版本（原 old_version）
- `newGraphVersion` — 新图版本（原 new_version）
- `triggerType` — 触发类型
- `traceId` — 链路追踪 ID
- `nodeRunId?` — 可选节点标识

### 3A.4 Execute Hub 事件

`ExecutionCompletedPayload` — **NodeAttemptReceipt 模型取代旧 execution 模型**

- `harnessRunId` — canonical 运行链锚点
- `nodeRunId` — NodeRun 标识（原 execution_id）
- `attemptId` — 尝试 ID
- `receiptId` — NodeAttemptReceipt ID
- `attemptStatus` — 尝试状态（取代 outcome）
- `outputRefs?` — 输出引用列表
- `traceId` — 链路追踪 ID
- `planGraphId?` — 可选计划图标识

**规则**：旧的 `execution_id` / `outcome` 字段已废弃。ExecutionCompletedPayload 必须使用 `nodeRunId` + `attemptId` + `attemptStatus` 的 NodeAttemptReceipt 模型，与 `node-run-attempt-receipt-contract.md` §5 保持一致。

### 3A.5 Feedback Hub 事件（ADR-079）

`FeedbackCollectedPayload`

- `harnessRunId` — canonical 运行链锚点
- `nodeRunId?` — 可选节点标识
- `feedbackId` — 反馈 ID
- `signalCount` — 信号数量
- `sources` — 来源列表
- `traceId` — 链路追踪 ID
- `planGraphId?` — 可选计划图标识

`FeedbackLearningSignalPayload`

- `signalId` — 信号 ID（canonical）
- `harnessRunId` — canonical 运行链锚点
- `learningSignalId` — 学习信号 ID
- `type` — 信号类型
- `confidence` — 置信度
- `sourceSignals` — 源信号列表
- `traceId` — 链路追踪 ID
- `nodeRunId?` — 可选节点标识

### 3A.6 Learn Hub 事件（ADR-080）

`LearningArtifactCreatedPayload`

- `learningObjectId` — 学习对象 ID
- `kind` — 对象类型
- `confidence` — 置信度
- `evidenceCount` — 证据数量
- `traceId` — 链路追踪 ID
- `harnessRunId?` — 可选运行链锚点
- `planGraphId?` — 可选计划图标识

`LearningObjectPromotedPayload`

- `learningObjectId` — 学习对象 ID
- `fromStatus` — 原状态
- `toStatus` — 新状态
- `namespace` — 命名空间
- `trustLevel` — 信任级别
- `traceId` — 链路追踪 ID
- `harnessRunId?` — 可选运行链锚点

### 3A.7 Improve Hub 事件（ADR-075）

`ImprovementCandidateCreatedPayload`

- `candidateId` — 候选 ID
- `learningObjectId` — 学习对象 ID
- `priority` — 优先级
- `targetScope` — 目标范围
- `traceId` — 链路追踪 ID
- `harnessRunId?` — 可选运行链锚点

`ImprovementPromotedPayload`

- `candidateId` — 候选 ID
- `fromLevel` — 原级别
- `toLevel` — 新级别
- `triggeredBy` — 触发者
- `durationMinutes` — 持续时间（分钟）
- `traceId` — 链路追踪 ID
- `harnessRunId?` — 可选运行链锚点

`ImprovementAutoRollbackPayload`

- `candidateId` — 候选 ID
- `fromLevel` — 原级别
- `toLevel` — 新级别
- `trigger` — 触发原因
- `metricsSnapshot` — 指标快照
- `traceId` — 链路追踪 ID
- `harnessRunId?` — 可选运行链锚点

### 3A.8 Release Hub 事件

`ReleaseStartedPayload`

- `harnessRunId` — canonical 运行链锚点
- `releaseId` — release ID
- `loopIteration` — 循环轮次
- `strategyVersion` — 策略版本
- `level` (`L0` | `L1` | `L2` | `L3` | `L4` | `L5`) — 发布级别
- `triggeredBy` — 触发者
- `tier?` — SLA tier（如有）

`ReleaseCompletedPayload`

- `releaseId` — release ID
- `candidateId` — 候选 ID
- `finalLevel` — 最终级别
- `totalDurationMinutes` — 总持续时间（分钟）
- `finalMetrics` — 最终指标
- `traceId` — 链路追踪 ID
- `harnessRunId?` — 可选运行链锚点

规则：

- payload schema 的破坏性变更必须通过新 type name 或显式版本升级处理。
- Tier 1 的 improvement / release 事件不得退化为无类型 `json` blob。
- 未启用的 M2 事件类型可以保留 schema 预留位，但不得在生产流量中伪造发布。
- OAPEFLIR 视图 / 理由事件类型统一使用 `oapeflir.view.<stage>.<event>` 或 `oapeflir.rationale.<stage>.<event>`；若消费的是 truth fact，则必须使用 `platform.*` namespace。

## 3B. Extension Plane Event Payload Types

若启用 `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` 基线，对应 extension-plane 事件也必须提供类型化 payload，至少覆盖：

`PluginIsolationEventPayload`

- `pluginId`
- `spiType`
- `phase`
- `reasonCode`
- `lifecycleState`
- `occurredAt`

`PluginInvocationEventPayload`

- `pluginId`
- `spiType`
- `phase`
- `invocationId`
- `status`
- `occurredAt`
- `durationMs?`
- `reasonCode?`

补充规则：

- `plugin:invocation_started` 与 `plugin:invocation_completed` 必须共享稳定 payload type，而不是各自漂移成 ad-hoc 字段集。
- extension-plane 事件允许先走进程内 typed bus，但不得因此伪装成跨进程可靠投递能力。
- `domain:* / plugin:* / knowledge:*` 事件若被 feedback 或 projection 消费，producer、consumer 和 payload schema 必须在 registry 中同时可追踪。

## 4. 兼容规则

- 向后兼容字段可新增，不可静默删除或改语义。
- 破坏性变更应新开 `event_type` 或显式版本。
- consumer 只应订阅自己声明支持的 event type。

## 5. 与现有 EventBus 的关系

- `event_bus_contract.md` 仍定义总线语义与确认边界。
- 本 contract 定义其上的类型冻结层。
- transport 升级时，不得破坏 typed event contract。

## 5.5 v4.3 Canonical 运行链标识

**强制要求**：所有 OAPEFLIR 事件 payload 必须以 `harnessRunId` 为顶层锚点，禁止以 `task_id`、`workflow_id`、`execution_id` 作为主键。

| 废弃字段 | canonical 替代 |
| --- | --- |
| `task_id` | `harnessRunId` |
| `workflow_id` | `planGraphId` |
| `execution_id` | `nodeRunId` + `attemptId` |
| `step_count` | `nodeCount` + `edgeCount`（PlanGraph 图结构） |

## 6. 收口结论

Typed Event Bus 不是另一套总线，而是给现有事件体系加上更强的 schema 和兼容保障。

## v4.3 Contract Remediation

- R2-67 / T-67: OAPEFLIR 事件 payload 原本全部使用 `task_id`/`workflow_id`/`execution_id`，根因是早期事件设计未接入 v4.3 运行链标识体系。修复：本文 3A 节所有 payload 类型现以 `harnessRunId`/`nodeRunId`/`planGraphId` 为权威锚点，废弃字段仅保留向后兼容注释。
- R2-68 / T-68: `PlanCreatedPayload` 使用 `step_count` 暗示线性步骤，与 §5 PlanGraph 图结构冲突。修复：本文现用 `nodeCount` + `edgeCount` 取代 `step_count`，显式表达图结构。
- R2-69 / T-69: `ExecutionCompletedPayload` 定义旧 execution 模型（execution_id/outcome），与 §5 NodeAttemptReceipt(receiptId/nodeRunId/attemptId/status) 冲突。修复：本文现使用 NodeAttemptReceipt 模型字段。
