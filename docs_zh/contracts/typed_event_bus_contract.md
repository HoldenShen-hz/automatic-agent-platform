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

要求：

- 所有 OAPEFLIR hub 事件必须同时拥有 schema ref 和稳定的 TypeScript payload type name。
- `stage` 若存在，必须来自 canonical OAPEFLIR stage 枚举，而不是消费方自定义标签。

## 3A. OAPEFLIR Event Payload Types

Phase 1-4 闭环事件必须提供类型化 payload，对应 ADR-079 和 ADR-080：

### 3A.1 Observe Hub 事件

`ObserveSignalsCollectedPayload`

- `task_id`
- `workflow_id?`
- `loop_iteration`
- `signal_count`
- `source_refs`
- `trace_id`

`UnifiedObservationCreatedPayload`

- `task_id`
- `observation_id`
- `situation_snapshot`
- `metrics`
- `trace_id`

### 3A.2 Assess Hub 事件

`AssessmentCompletedPayload`

- `task_id`
- `assessment_id`
- `complexity`
- `risk_level`
- `confidence`
- `trace_id`

### 3A.3 Plan Hub 事件

`PlanCreatedPayload`

- `task_id`
- `plan_id`
- `version`
- `strategy`
- `step_count`
- `trace_id`

`ReplanTriggeredPayload`

- `task_id`
- `plan_id`
- `old_version`
- `new_version`
- `trigger_type`
- `trace_id`

### 3A.4 Execute Hub 事件

`ExecutionCompletedPayload`

- `task_id`
- `execution_id`
- `outcome`
- `output_refs`
- `trace_id`

### 3A.5 Feedback Hub 事件（ADR-079）

`FeedbackCollectedPayload`

- `task_id`
- `feedback_id`
- `signal_count`
- `sources`
- `trace_id`

`FeedbackLearningSignalPayload`

- `signal_id`
- `task_id`
- `learning_signal_id`
- `type`
- `confidence`
- `source_signals`
- `trace_id`

### 3A.6 Learn Hub 事件（ADR-080）

`LearningArtifactCreatedPayload`

- `learning_object_id`
- `kind`
- `confidence`
- `evidence_count`
- `trace_id`

`LearningObjectPromotedPayload`

- `learning_object_id`
- `from_status`
- `to_status`
- `namespace`
- `trust_level`
- `trace_id`

### 3A.7 Improve Hub 事件（ADR-075）

`ImprovementCandidateCreatedPayload`

- `candidate_id`
- `learning_object_id`
- `priority`
- `target_scope`
- `trace_id`

`ImprovementPromotedPayload`

- `candidate_id`
- `from_level`
- `to_level`
- `triggered_by`
- `duration_minutes`
- `trace_id`

`ImprovementAutoRollbackPayload`

- `candidate_id`
- `from_level`
- `to_level`
- `trigger`
- `metrics_snapshot`
- `trace_id`

### 3A.8 Release 事件

`ReleaseRolloutStartedPayload`

- `task_id`
- `rollout_id`
- `loop_iteration`
- `strategy_version`
- `level` (`L0` | `L1` | `L2` | `L3` | `L4` | `L5`)
- `triggered_by`

`ReleaseRolloutCompletedPayload`

- `rollout_id`
- `candidate_id`
- `final_level`
- `total_duration_minutes`
- `final_metrics`
- `trace_id`

规则：

- payload schema 的破坏性变更必须通过新 type name 或显式版本升级处理。
- Tier 1 的 improvement / rollout 事件不得退化为无类型 `json` blob。
- 未启用的 M2 事件类型可以保留 schema 预留位，但不得在生产流量中伪造发布。
- OAPEFLIR 事件类型统一使用 `<stage>:<event>` 格式（如 `feedback:collected`、`learning:object_promoted`）。

## 3B. Extension Plane Event Payload Types

若启用 `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` 基线，对应 extension-plane 事件也必须提供类型化 payload，至少覆盖：

`PluginIsolationEventPayload`

- `plugin_id`
- `spi_type`
- `phase`
- `reason_code`
- `lifecycle_state`
- `occurred_at`

`PluginInvocationEventPayload`

- `plugin_id`
- `spi_type`
- `phase`
- `invocation_id`
- `status`
- `occurred_at`
- `duration_ms?`
- `reason_code?`

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

## 6. 收口结论

Typed Event Bus 不是另一套总线，而是给现有事件体系加上更强的 schema 和兼容保障。
