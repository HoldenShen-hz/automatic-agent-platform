# Runtime 审计与软删除规范

## 目标

为 runtime physical schema 中的核心业务表建立统一的审计字段和软删除约束，避免只有 `mission_records` 具备完整审计链路、其余表难以追踪责任人和状态演化的问题。

## 标准字段

以下字段属于核心业务表的默认要求：

- `created_at TEXT NOT NULL`
- `created_by TEXT NULL`
- `updated_at TEXT NULL`
- `updated_by TEXT NULL`
- `archived_at TEXT NULL`
- `archived_by TEXT NULL`
- `is_deleted INTEGER NOT NULL DEFAULT 0`
- `deleted_at TEXT NULL`
- `deleted_by TEXT NULL`

字段语义：

- `created_*` 记录首次落库时间和责任主体。
- `updated_*` 记录最近一次状态或内容变更。
- `archived_*` 用于业务归档，不等同于删除。
- `is_deleted` + `deleted_*` 表示软删除；SQLite 中布尔值统一使用 `INTEGER 0/1`。

## 必须具备完整字段的核心表

- `task_drafts`
- `confirmed_task_specs`
- `request_envelopes`
- `harness_runs`
- `plan_graph_bundles`
- `graph_patches`
- `node_runs`
- `node_attempts`
- `node_attempt_receipts`
- `side_effect_records`
- `budget_ledgers`
- `budget_reservations`
- `budget_settlements`
- `mission_records`
- `mission_memberships`
- `mission_context_snapshots`
- `run_version_locks`
- `artifact_version_lock_sets`
- `decision_input_bundles`
- `harness_decisions`
- `human_responsibility_records`

这些表都属于可被纠偏、归档、重放、对账或人工追责的业务状态，因此必须有责任主体与软删除痕迹。

## 允许豁免的系统表

以下表保留为追加型或系统型结构，不强制补齐软删除字段：

- `mission_event_sequences`
- `runtime_event_log`
- `runtime_outbox`
- `runtime_audit_refs`

豁免规则：

- 追加型事件流表依赖不可变语义，删除会破坏事件序列或 outbox 投递证据。
- 纯系统计数/引用表由运行时机制维护，重点是不可变和主键幂等，不是业务归档。

## 落库约束

- 新增 runtime 业务表时，默认先纳入“必须具备完整字段的核心表”。
- 如需豁免，必须在设计评审中说明其追加型或系统型原因，并同步更新本规范与对应审计脚本。
- 运行时查询在实现软删除读取语义时，应显式过滤 `is_deleted = 0`，不能依赖调用方约定。
