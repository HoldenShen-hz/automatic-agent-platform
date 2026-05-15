# Storage Schema Contract

## 1. 范围

本 contract 定义 Phase 1a 平台必须持久化的核心实体、最小列集合、关键索引、外键策略和恢复语义。

本版重点补齐 v4.3 runtime truth 对应的存储落点，包括：

- `harness_runs`
- `plan_graph_bundles`
- `node_runs`
- `node_attempts`
- `node_attempt_receipts`
- `budget_ledgers`
- `budget_reservations`

同时定义 OAPEFLIR 闭环在存储层的分阶段边界：

- phase1-4 authoritative：当前必须稳定存在并能支撑恢复、审批、事件审计、artifact / memory 最小落盘的核心表。
- transition / target-state extension：反馈、学习、改进、发布、知识与高阶记忆治理所需的扩展表族与列语义；允许按阶段演进，不得误写为当前全部已落库。

## 2. 存储原则

- Phase 1a 默认使用 SQLite 作为单机 authoritative store。
- 表结构优先服务任务恢复、审批追踪、事件审计和 runtime run 重建。
- 大体积数据优先落 artifact，再在 DB 中保留索引和引用。
- Phase 1a 明确启用 `PRAGMA foreign_keys = ON`。
- Phase 1a 默认启用 `WAL`、`busy_timeout` 和显式事务边界控制。
- 高频 heartbeat 和展示类流量不要求逐条重型持久化，应以采样快照或最新状态为主。
- migration、备份、恢复、`integrity_check` 与损坏检测属于 Stable Core 的数据库托底要求。

## 3. 核心表与扩展表

authoritative schema 至少包含以下核心表：

- `harness_runs`
- `plan_graph_bundles`
- `node_runs`
- `node_attempts`
- `node_attempt_receipts`
- `budget_ledgers`
- `budget_reservations`
- `tasks`
- `workflow_state`
- `workflow_step_outputs`
- `sessions`
- `messages`
- `events`
- `event_consumer_acks`
- `session_logs`
- `approvals`
- `file_locks`
- `memories`
- `tool_result_files`

说明：

- 上表定义的是 v4.3 canonical truth + projection 最小核心表集合，不是实现可拥有的全部表。
- `tasks`、`workflow_state`、`workflow_step_outputs`、`sessions`、`messages` 保留为 projection / interaction 表，不再单独承载 runtime truth。
- 当前实现还允许并实际包含多类扩展表，例如：
  - 组织与租户域：`organizations`、`workspaces`、`tenants`、`deployment_bindings`
  - 供应链与治理域：`skill_registry`、`skill_execution_policies`、`extension_packages`、`marketplace_*`
  - 安全与密钥域：`secret_registry`、`secret_leases`、`secret_usage_audits`、`secret_rotation_events`
  - 计费与数据域：`billing_accounts`、`usage_events`、`quota_counters`、`analytics_facts`、`archive_bundles`
  - 进化与 Observe-compatible 域：`evolution_*`、`perception_sources`、`intel_items`、`intel_briefs`（保留 legacy 表名，语义已按 Observe 收口）
- 因此 contract 对核心表使用“最小集合”约束；扩展表可在不破坏核心约束的前提下继续增加。

### 3B. Authoritative Schema Inventory

当前仓内不再用架构文档中的静态“总表数”直接做验收口径，而是以 authoritative inventory 为准：

- authoritative service：`src/platform/five-plane-state-evidence/truth/schema-inventory-service.ts`
- authoritative API surface：`GET /v1/admin/inventories/schema`
- 当前 inventory 对账口径：`86` 张唯一逻辑表
- 分类汇总：
  - `core_truth`: `55`
  - `runtime_extension`: `18`
  - `governance_extension`: `9`
  - `reliability_extension`: `4`

约束：

- 后续 schema 演进必须同步更新 inventory service 与对应测试，不再只在 review 中手工维护数字。
- review / coverage-matrix / contract 中出现的表数量，应以 inventory service 导出的数字为 authoritative source。

### 3A. OAPEFLIR 扩展表族

以下表族属于 `§K` 对 storage schema 的 canonical 扩展方向：

- `feedback_signals`
- `learning_objects`
- `improvement_candidates`
- `strategy_versions`
- `rollout_records`
- `knowledge_entries`
- `knowledge_semantic_vectors`

约束：

- 这些表族可以以 `Current -> Transition -> Target` 方式落地，不要求当前仓库一次性全部变成 authoritative 运行依赖。
- 但 contract、migration 规划、diagnostics 和 lineage 文档必须为这些对象预留统一命名与最小字段语义。

建议最小字段：

| 表 | 最小字段 |
| --- | --- |
| `feedback_signals` | `id`、`task_id?`、`workflow_id?`、`kind`、`sentiment?`、`source`、`evidence_ref?`、`created_at` |
| `learning_objects` | `id`、`source_refs_json`、`promotion_status`、`quality_score?`、`created_at` |
| `improvement_candidates` | `id`、`change_scope`、`strategy_version?`、`status`、`created_at` |
| `strategy_versions` | `id`、`version`、`diff_ref?`、`status`、`created_at` |
| `rollout_records` | `id`、`strategy_version`、`stage`、`status`、`metrics_json?`、`created_at` |
| `knowledge_entries` | `id`、`namespace`、`trust_tier`、`freshness_state`、`source_ref?`、`created_at` |
| `knowledge_semantic_vectors` | `knowledge_ref`、`chunk_id`、`document_id`、`namespace`、`embedding_id?`、`embedding_model`、`embedding`、`updated_at` |

## 4. `tasks` 表最小列

| 列名 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `TEXT PRIMARY KEY` | 任务 ID |
| `parent_id` | `TEXT NULL` | 父任务 |
| `root_id` | `TEXT NOT NULL` | 根任务 |
| `division_id` | `TEXT NULL` | 目标事业部 |
| `title` | `TEXT NOT NULL` | 标题 |
| `status` | `TEXT NOT NULL` | 任务状态枚举 |
| `source` | `TEXT NOT NULL` | 来源 |
| `priority` | `TEXT NOT NULL` | 优先级 |
| `input_json` | `TEXT NOT NULL` | 原始输入 JSON |
| `normalized_input_json` | `TEXT NULL` | 规范化输入 |
| `output_json` | `TEXT NULL` | 输出摘要 |
| `estimated_cost_usd` | `REAL NULL` | 预估成本 |
| `actual_cost_usd` | `REAL NOT NULL DEFAULT 0` | 实际成本 |
| `error_code` | `TEXT NULL` | 最近错误码 |
| `created_at` | `TEXT NOT NULL` | 创建时间 |
| `updated_at` | `TEXT NOT NULL` | 更新时间 |
| `completed_at` | `TEXT NULL` | 完成时间 |

索引要求：

- `idx_tasks_root_id`
- `idx_tasks_parent_id`
- `idx_tasks_status_created_at`
- `idx_tasks_division_status`

## 5. `workflow_state` 表最小列

| 列名 | 类型 | 说明 |
| --- | --- | --- |
| `task_id` | `TEXT PRIMARY KEY` | 关联任务 |
| `division_id` | `TEXT NOT NULL` | 归属事业部 |
| `workflow_id` | `TEXT NOT NULL` | workflow ID |
| `current_step_index` | `INTEGER NOT NULL` | 当前步骤索引 |
| `status` | `TEXT NOT NULL` | workflow 状态 |
| `outputs_json` | `TEXT NOT NULL` | 输出快照 |
| `last_error_code` | `TEXT NULL` | 最近错误码 |
| `retry_count` | `INTEGER NOT NULL DEFAULT 0` | 重试次数 |
| `resumable_from_step` | `TEXT NULL` | 可恢复步骤 |
| `started_at` | `TEXT NOT NULL` | 开始时间 |
| `updated_at` | `TEXT NOT NULL` | 更新时间 |

索引要求：

- `idx_workflow_state_division_status`
- `idx_workflow_state_updated_at`

## 6. `workflow_step_outputs` 表最小列

- `id TEXT PRIMARY KEY`
- `task_id TEXT NOT NULL`
- `step_id TEXT NOT NULL`
- `role_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `data_json TEXT NOT NULL`
- `summary TEXT NULL`
- `artifacts_json TEXT NULL`
- `token_cost REAL NOT NULL DEFAULT 0`
- `duration_ms INTEGER NOT NULL DEFAULT 0`
- `validation_json TEXT NULL`
- `produced_at TEXT NOT NULL`

索引要求：

- `idx_step_outputs_task_id`
- `idx_step_outputs_task_step UNIQUE(task_id, step_id)`

## 7. `harness_runs` / `plan_graph_bundles` / `node_runs` / `node_attempts` / `node_attempt_receipts`

这些表承接 v4.3 canonical runtime truth。

`harness_runs` 最小列：

- `harness_run_id TEXT PRIMARY KEY`
- `tenant_id TEXT NOT NULL`
- `confirmed_task_spec_id TEXT NOT NULL`
- `request_envelope_id TEXT NOT NULL`
- `request_hash TEXT NOT NULL`
- `status TEXT NOT NULL`
- `constraint_pack_ref TEXT NOT NULL`
- `version_lock_id TEXT NOT NULL`
- `plan_graph_bundle_id TEXT NULL`
- `budget_ledger_id TEXT NOT NULL`
- `current_seq INTEGER NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `terminal_at TEXT NULL`
- `terminal_reason TEXT NULL`

`plan_graph_bundles` 最小列：

- `plan_graph_bundle_id TEXT PRIMARY KEY`
- `harness_run_id TEXT NOT NULL`
- `graph_version INTEGER NOT NULL`
- `graph_json TEXT NOT NULL`
- `scheduler_policy_json TEXT NOT NULL`
- `budget_json TEXT NOT NULL`
- `risk_profile_json TEXT NOT NULL`
- `validation_report_json TEXT NOT NULL`
- `artifact_refs_json TEXT NULL`
- `created_at TEXT NOT NULL`

`node_runs` 最小列：

- `node_run_id TEXT PRIMARY KEY`
- `harness_run_id TEXT NOT NULL`
- `plan_graph_bundle_id TEXT NOT NULL`
- `graph_version INTEGER NOT NULL`
- `node_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `attempt_count INTEGER NOT NULL DEFAULT 0`
- `lease_id TEXT NULL`
- `fencing_token TEXT NULL`
- `current_seq INTEGER NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `terminal_reason TEXT NULL`

`node_attempts` 最小列：

- `node_attempt_id TEXT PRIMARY KEY`
- `node_run_id TEXT NOT NULL`
- `attempt_no INTEGER NOT NULL`
- `attempt_kind TEXT NOT NULL`
- `executor_ref TEXT NOT NULL`
- `input_snapshot_ref TEXT NOT NULL`
- `started_at TEXT NOT NULL`
- `completed_at TEXT NULL`
- `receipt_id TEXT NULL`

`node_attempt_receipts` 最小列：

- `node_attempt_receipt_id TEXT PRIMARY KEY`
- `node_attempt_id TEXT NOT NULL`
- `node_run_id TEXT NOT NULL`
- `receipt_kind TEXT NOT NULL`
- `status TEXT NOT NULL`
- `output_ref TEXT NULL`
- `error_json TEXT NULL`
- `side_effect_refs_json TEXT NULL`
- `budget_settlement_refs_json TEXT NULL`
- `evidence_refs_json TEXT NULL`
- `produced_at TEXT NOT NULL`

索引要求：

- `idx_harness_runs_request_hash UNIQUE(request_hash)`
- `idx_harness_runs_tenant_status`
- `idx_plan_graph_bundle_run_version UNIQUE(harness_run_id, graph_version)`
- `idx_node_runs_harness_status`
- `idx_node_runs_bundle_node UNIQUE(plan_graph_bundle_id, node_id, graph_version)`
- `idx_node_attempts_node_run_attempt UNIQUE(node_run_id, attempt_no)`
- `idx_node_attempt_receipts_attempt UNIQUE(node_attempt_id)`

## 8. `budget_ledgers` 与 `budget_reservations`

`budget_ledgers`：

- `budget_ledger_id TEXT PRIMARY KEY`
- `tenant_id TEXT NOT NULL`
- `harness_run_id TEXT NOT NULL`
- `currency TEXT NOT NULL`
- `hard_cap REAL NOT NULL`
- `soft_cap REAL NULL`
- `reserved_amount REAL NOT NULL DEFAULT 0`
- `settled_amount REAL NOT NULL DEFAULT 0`
- `released_amount REAL NOT NULL DEFAULT 0`
- `status TEXT NOT NULL`
- `version INTEGER NOT NULL`

`budget_reservations`：

- `budget_reservation_id TEXT PRIMARY KEY`
- `budget_ledger_id TEXT NOT NULL`
- `harness_run_id TEXT NOT NULL`
- `node_run_id TEXT NULL`
- `amount REAL NOT NULL`
- `resource_kind TEXT NOT NULL`
- `status TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`

索引要求：

- `idx_budget_ledgers_harness_run UNIQUE(harness_run_id)`
- `idx_budget_reservations_ledger_status`
- `idx_budget_reservations_node_run`

## 10. `sessions` 与 `messages` 表最小列

`sessions`：

- `id TEXT PRIMARY KEY`
- `task_id TEXT NOT NULL`
- `channel TEXT NOT NULL`
- `status TEXT NOT NULL`
- `external_session_id TEXT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

`messages`：

- `id TEXT PRIMARY KEY`
- `session_id TEXT NOT NULL`
- `direction TEXT NOT NULL`
- `message_type TEXT NOT NULL`
- `content TEXT NOT NULL`
- `attachments_json TEXT NULL`
- `created_at TEXT NOT NULL`

索引要求：

- `idx_sessions_task_id`
- `idx_messages_session_created_at`

`session_logs`（append-only 审计/回放层，Phase 2c / 3 演进目标）：

- `id TEXT PRIMARY KEY`
- `session_id TEXT NOT NULL`
- `sequence INTEGER NOT NULL`
- `entry_type TEXT NOT NULL`
- `payload_json TEXT NOT NULL`
- `created_at TEXT NOT NULL`

索引要求：

- `idx_session_logs_session_sequence UNIQUE(session_id, sequence)`

## 11. `events` 与 `approvals` 表最小列

`events`：

- `id TEXT PRIMARY KEY`
- `task_id TEXT NULL`
- `execution_id TEXT NULL`
- `event_type TEXT NOT NULL`
- `event_tier TEXT NOT NULL`
- `payload_json TEXT NOT NULL`
- `trace_id TEXT NULL`
- `created_at TEXT NOT NULL`

`event_consumer_acks`：

- `id TEXT PRIMARY KEY`
- `event_id TEXT NOT NULL`
- `consumer_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `last_attempt_at TEXT NULL`
- `acked_at TEXT NULL`
- `error_code TEXT NULL`
- `attempt_count INTEGER NOT NULL DEFAULT 0`

`approvals`：

- `id TEXT PRIMARY KEY`
- `task_id TEXT NOT NULL`
- `execution_id TEXT NULL`
- `status TEXT NOT NULL`
- `request_json TEXT NOT NULL`
- `response_json TEXT NULL`
- `timeout_policy TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `responded_at TEXT NULL`

索引要求：

- `idx_events_task_created_at`
- `idx_events_execution_created_at`
- `idx_events_type_created_at`
- `idx_event_consumer_event_consumer UNIQUE(event_id, consumer_id)`
- `idx_approvals_task_status`

## 12. `file_locks` 表最小列

- `id TEXT PRIMARY KEY`
- `task_id TEXT NULL`
- `execution_id TEXT NULL`
- `lock_scope TEXT NOT NULL`
- `resource_path TEXT NOT NULL`
- `lock_mode TEXT NOT NULL`
- `owner_id TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

索引要求：

- `idx_file_locks_owner`
- `idx_file_locks_resource`

## 13. `memories` 与 `tool_result_files` 表最小列

`memories`：

- `id TEXT PRIMARY KEY`
- `task_id TEXT NULL`
- `session_id TEXT NULL`
- `agent_id TEXT NULL`
- `execution_id TEXT NULL`
- `memory_layer TEXT NOT NULL`
- `layer_level INTEGER NOT NULL`
- `content_json TEXT NOT NULL`
- `embedding_ref TEXT NULL`
- `token_budget INTEGER NULL`
- `freshness_state TEXT NOT NULL DEFAULT 'fresh'`
- `source_refs_json TEXT NULL`
- `created_at TEXT NOT NULL`

补充约束：

- `memory_layer` 必须可映射到 `L1-L6`。
- `layer_level` 建议与 `L1-L6` 一一对应为 `1-6`，方便排序与迁移。
- `source_refs_json` 应优先存储 `ArtifactRef / EvidenceRef / MemoryRef / KnowledgeRef`。

`tool_result_files`：

- `id TEXT PRIMARY KEY`
- `task_id TEXT NOT NULL`
- `execution_id TEXT NULL`
- `tool_name TEXT NOT NULL`
- `artifact_id TEXT NOT NULL`
- `file_path TEXT NOT NULL`
- `mime_type TEXT NULL`
- `size_bytes INTEGER NULL`
- `created_at TEXT NOT NULL`

## 14. 外键策略

Phase 1a 明确采用以下策略：

- `workflow_state.task_id -> tasks.id`
- `workflow_step_outputs.task_id -> tasks.id`
- `plan_graph_bundles.harness_run_id -> harness_runs.harness_run_id`
- `node_runs.harness_run_id -> harness_runs.harness_run_id`
- `node_runs.plan_graph_bundle_id -> plan_graph_bundles.plan_graph_bundle_id`
- `node_attempts.node_run_id -> node_runs.node_run_id`
- `node_attempt_receipts.node_attempt_id -> node_attempts.node_attempt_id`
- `node_attempt_receipts.node_run_id -> node_runs.node_run_id`
- `budget_ledgers.harness_run_id -> harness_runs.harness_run_id`
- `budget_reservations.budget_ledger_id -> budget_ledgers.budget_ledger_id`
- `budget_reservations.node_run_id -> node_runs.node_run_id`
- `sessions.task_id -> tasks.id`
- `messages.session_id -> sessions.id`
- `event_consumer_acks.event_id -> events.id`
- `approvals.task_id -> tasks.id`
- `approvals.harness_run_id -> harness_runs.harness_run_id`
- `approvals.node_run_id -> node_runs.node_run_id`
- `file_locks.node_run_id -> node_runs.node_run_id`
- `tool_result_files.node_run_id -> node_runs.node_run_id`

说明：

- `events.task_id` 与 `events.execution_id` 允许为空，因此不强制所有事件都绑定任务或执行。
- `memories` 支持跨 task/session/agent/execution 的多来源写入，Phase 1a 不强制单一外键。
- 所有必须绑定任务主线或 runtime run 的数据，都应由 SQLite 外键直接约束，而不是只靠应用层自觉维护。

## 14A. Transition / Target-State 补充说明

为与 `runtime_repository_and_migration_contract.md` 保持一致，存储层采用三态迁移语义：

- `Current`：`harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / budget_ledgers / budget_reservations` 为 runtime truth；`tasks / workflow / approvals / events / artifacts / memories` 等为混合 projection/evidence 表。
- `Transition`：扩展表族可先以 append-only、shadow write、reporting-only 或 evidence-only 方式接入。
- `Target`：`feedback / learning / improvement / rollout / knowledge / high-order memory` 成为稳定治理对象并与 typed ref / lineage 全面对齐。

因此：

- 本 contract 允许当前实现仍以最小核心表为主。
- 但新增 schema、migration、inspection 或 audit 设计时，不得再引入与上述表族平行冲突的命名。

## 15. SQLite 初版 DDL 附录

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  parent_id TEXT NULL,
  root_id TEXT NOT NULL,
  division_id TEXT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  priority TEXT NOT NULL,
  input_json TEXT NOT NULL,
  normalized_input_json TEXT NULL,
  output_json TEXT NULL,
  estimated_cost_usd REAL NULL,
  actual_cost_usd REAL NOT NULL DEFAULT 0,
  error_code TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_root_id ON tasks(root_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_created_at ON tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_division_status ON tasks(division_id, status);

CREATE TABLE IF NOT EXISTS workflow_state (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  division_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  current_step_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  outputs_json TEXT NOT NULL,
  last_error_code TEXT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  resumable_from_step TEXT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_state_division_status
  ON workflow_state(division_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_state_updated_at
  ON workflow_state(updated_at);

CREATE TABLE IF NOT EXISTS workflow_step_outputs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  status TEXT NOT NULL,
  data_json TEXT NOT NULL,
  summary TEXT NULL,
  artifacts_json TEXT NULL,
  token_cost REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  validation_json TEXT NULL,
  produced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_step_outputs_task_id
  ON workflow_step_outputs(task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_step_outputs_task_step
  ON workflow_step_outputs(task_id, step_id);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workflow_id TEXT NULL,
  parent_execution_id TEXT NULL REFERENCES executions(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL,
  role_id TEXT NULL,
  run_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  input_ref TEXT NULL,
  trace_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  timeout_ms INTEGER NOT NULL,
  budget_usd_limit REAL NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  sandbox_mode TEXT NULL,
  allowed_tools_json TEXT NULL,
  allowed_paths_json TEXT NULL,
  max_retries INTEGER NOT NULL DEFAULT 0,
  retry_backoff TEXT NOT NULL DEFAULT 'none',
  last_error_code TEXT NULL,
  last_error_message TEXT NULL,
  started_at TEXT NULL,
  finished_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_executions_task_created_at
  ON executions(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_executions_task_status
  ON executions(task_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_trace_id
  ON executions(trace_id);
CREATE INDEX IF NOT EXISTS idx_executions_parent_execution_id
  ON executions(parent_execution_id);
CREATE INDEX IF NOT EXISTS idx_executions_agent_status
  ON executions(agent_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_executions_task_attempt
  ON executions(task_id, attempt, run_kind);

CREATE TABLE IF NOT EXISTS execution_prechecks (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  allowed INTEGER NOT NULL,
  reason_code TEXT NULL,
  resolved_budget_usd REAL NULL,
  resolved_timeout_ms INTEGER NOT NULL,
  resolved_sandbox_mode TEXT NOT NULL,
  resolved_tools_json TEXT NULL,
  resolved_paths_json TEXT NULL,
  checked_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_prechecks_execution_id
  ON execution_prechecks(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_prechecks_checked_at
  ON execution_prechecks(checked_at);

CREATE TABLE IF NOT EXISTS dead_letters (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  final_reason_code TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT NULL,
  moved_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dead_letters_execution_id
  ON dead_letters(execution_id);
CREATE INDEX IF NOT EXISTS idx_dead_letters_task_id
  ON dead_letters(task_id);
CREATE INDEX IF NOT EXISTS idx_dead_letters_reason_moved_at
  ON dead_letters(final_reason_code, moved_at);

CREATE TABLE IF NOT EXISTS heartbeat_snapshots (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_message TEXT NULL,
  cpu_pct REAL NULL,
  memory_mb REAL NULL,
  sampled_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_execution_sampled_at
  ON heartbeat_snapshots(execution_id, sampled_at);
CREATE INDEX IF NOT EXISTS idx_heartbeat_agent_sampled_at
  ON heartbeat_snapshots(agent_id, sampled_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  external_session_id TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_task_id
  ON sessions(task_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  attachments_json TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created_at
  ON messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  task_id TEXT NULL,
  execution_id TEXT NULL,
  event_type TEXT NOT NULL,
  event_tier TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  trace_id TEXT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_task_created_at
  ON events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_execution_created_at
  ON events(execution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type_created_at
  ON events(event_type, created_at);

CREATE TABLE IF NOT EXISTS event_consumer_acks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  consumer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_attempt_at TEXT NULL,
  acked_at TEXT NULL,
  error_code TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_consumer_event_consumer
  ON event_consumer_acks(event_id, consumer_id);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  execution_id TEXT NULL,
  status TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NULL,
  timeout_policy TEXT NOT NULL,
  created_at TEXT NOT NULL,
  responded_at TEXT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_task_status
  ON approvals(task_id, status);

CREATE TABLE IF NOT EXISTS file_locks (
  id TEXT PRIMARY KEY,
  task_id TEXT NULL,
  execution_id TEXT NULL,
  lock_scope TEXT NOT NULL,
  resource_path TEXT NOT NULL,
  lock_mode TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_locks_owner
  ON file_locks(owner_id);
CREATE INDEX IF NOT EXISTS idx_file_locks_resource
  ON file_locks(resource_path);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  task_id TEXT NULL,
  session_id TEXT NULL,
  agent_id TEXT NULL,
  execution_id TEXT NULL,
  memory_layer TEXT NOT NULL,
  layer_level INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  embedding_ref TEXT NULL,
  token_budget INTEGER NULL,
  freshness_state TEXT NOT NULL DEFAULT 'fresh',
  source_refs_json TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_result_files (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  execution_id TEXT NULL REFERENCES executions(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NULL,
  size_bytes INTEGER NULL,
  created_at TEXT NOT NULL
);
```

## 16. Runtime 存储边界

- `harness_runs / node_runs / node_attempts / node_attempt_receipts / budget_*` 是 v4.3 runtime truth 主表族。
- `runtime_repository_and_migration_contract.md` 定义这些表如何被 repository 消费以及 migration 如何演进。
- `events` 负责事实事件与恢复链，`event_consumer_acks` 负责按消费者确认，存活观测只是派生观测层，两者不要混用。
- `file_locks` 是并发写保护的 authoritative 存储，不得只保留在进程内存中。

## 17. Artifact 索引边界

- artifact 主体存文件系统或对象存储。
- `tool_result_files` 负责 Phase 1a 的最小索引。
- 未来若 artifact 类型扩大，应新增独立 `artifacts` 索引表，而不是把 BLOB 回灌到核心任务表。

## 18. 恢复与事务要求

- `harness_runs.status`、`node_runs.status` 与相关 projection 的关键更新应尽量在同一事务内完成。
- 新建 `HarnessRun` / `NodeRun` / `NodeAttempt` 时，应同时写入初始 truth 记录，不能先跑后补账。
- run 进入 `awaiting_hitl` 或 `policy_blocked` 时，审批记录与等待态持久化必须可靠。
- run 进入终态时，应保证最后错误码、尝试次数、预算结算和终态时间可恢复。
- Tier 1 事件写入不能被可选优化路径绕过。
- 过期 file lock 的回收必须能基于 `file_locks` 与 `node_runs` 联合判定。
- 恢复流程至少能基于 `harness_runs`、`plan_graph_bundles`、`node_runs`、`node_attempts`、`node_attempt_receipts`、`budget_reservations`、`events`、`file_locks` 重建执行上下文。

## 19. 补充规则

- PostgreSQL 迁移时，主键、唯一约束、外键与时间戳语义必须保持一致，SQLite shortcut 不得带入 PG 事实源。
- 完整 artifact 索引表至少拆分出：artifact 主记录、artifact version、artifact access log。
- heartbeat 快照可按窗口压缩保留，但最新快照和与 incident 相关的窗口不得被压缩掉。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-33: 本文原先把 `tasks / workflow_state / executions` 写成 storage truth 主链，根因是存储合同直接复用了 v3 单机表模型，没有随着 `HarnessRun / PlanGraphBundle / NodeRun / NodeAttemptReceipt / BudgetLedger` 成为 canonical runtime truth 一起迁移。修复：正文现把核心 truth 表族改为 `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / budget_ledgers / budget_reservations`，并把旧表降为 projection / compatibility 层。
- T-34: 本文在 §13 的 `memories` 最小列里声明了 `layer_level / token_budget / freshness_state / source_refs_json`，但 SQLite DDL 附录仍缺这些列，根因是正文 schema 和附录 DDL 在一次 memory contract 扩展后没有同步维护。修复：正文与 DDL 现已对齐，`memories` 表的最小列和 DDL 同步包含这四个字段。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
