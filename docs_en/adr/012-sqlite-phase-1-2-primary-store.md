# ADR-012 SQLite isno作为 Ring 1-2 defaults to主storage

- Status：Accepted
- Decision日期：2026-04-03

## Background

平台当前还occurrences于 Phase 1a / 1b 的基础闭环阶段，优先目标is把任务、workflow、execution、approval、event、session、recovery 路径跑稳，而不is一开始就上分层data平面或多租户事务基础设施。

需要Decision的Issueis：

- Ring 1 isno继续以 SQLite 作为defaults to主事务storage。
- 何时必须退出这一Decision。

## Decision

Ring 1 vs Ring 2 早期继续以 SQLite 作为defaults to / 首选主事务storage。

同时明确边界：

- SQLite 继续承担当前阶段最主要的单机 authoritative 事务storage。
- PostgreSQL 后端可以作为受控替代实现存在，used for双写演练、concurrent验证和后续迁移准备，但不得bypassing既有 storage contract。
- artifact 主体仍可存文件系统或对象storage，但索references和事实Status以 SQLite 为准。
- 进入更复杂的data平面后，再按 `data_plane_contract.md` 演进为分层storage。
- OAPEFLIR 新增的 `TaskSituation / Assessment / PlanRationale / Feedback / Learning / Improvement / ReleaseDecisionView` 等认知投影对象，在当前阶段仍必须能映射回 `harness_runs / node_runs / node_attempt_receipts` 这组 SQLite authoritative truth 边界。

## 备选方案

### 方案 A：当前阶段directly采用 PostgreSQL

优点：

- concurrent能力更强。
- 更接近未来多租户 / 多 worker 形态。

代价：

- 本地开发、测试、发布和运维复杂度显著增加。
- 现在的主风险不is DB upper limit，而is contract 尚未完全映射到code。
- 早期会把大量精力耗在基础设施而不is产品闭环上。

### 方案 B：SQLite + 其他cache/队列混合方案

优点：

- 可局部缓解writes压力。

代价：

- 系统复杂度上升，但真正的Issue边界可能仍未收紧。
- 会过早references入多种 authoritative 来源。

### 方案 C：当前Decision方案

- SQLite 继续作为唯一主事务storage
- 明确concurrent、背压和 Phase 边界
- 后续再via ADR 和 contract 正式升级

## 选择这个方案的原因

- 当前阶段最需要的is低运维成本、高可复制性和本地可调试性。
- SQLite 足以支撑 Phase 1a / 1b 的单机闭环。
- 现在先把Status、事件、审批、恢复和storage schema 收紧，比提前上更重data库更关键。
- 项目已via有清晰的data平面演进文档，不会因为当前选择 SQLite 就丢掉后续升级路径。

## 关键不variable

- SQLite is当前defaults to authoritative 事务源。
- 若enabled PostgreSQL，必须via受控 storage adapter / migration / dual-run 方案接入，不能形成未受治理的第二套业务语义。
- `foreign_keys = ON` is正式运lines要求，不isoptional优化。
- 高价值事实Status不得只存在内存。
- 不允许把“SQLite 未来会迁移”当成当前可忽略一致性的借口。
- OAPEFLIR 演化实体即使暂时由轻量服务或内存注册table托管，也必须能映射回 `HarnessRun / NodeRun / NodeAttemptReceipt` 的 SQLite authoritative 事实边界，不能形成不受治理的第二真相源。

## 采用触发条件

只要系统仍满足以下条件，就继续维持本Decision：

- 单机为主
- Phase 1a / 1b 主链为主
- concurrent规模仍受控
- 多租户、远程 worker、分析平面尚未进入正式实现

## 退出条件

出现以下任一情况，应重新Decision：

- execution plane 进入多 worker / queue / lease 主体实现
- 单机writes瓶颈成为持续Issue，且背压/异步批量已不足以缓解
- 多租户或 enterprise 事务隔离正式进入实现范围
- analytics / archive / replay 需要独立data平面

## 实施Impact

当前必须配套做到：

- schema、migration、repository 和恢复巡检都按 SQLite 边界设计
- FileLock、event ack、execution、approval 都落到 SQLite authoritative table
- via背压和运lines约束控制exceeds阶段concurrent
- 当 phase1-4 references入 `learning_objects`、`improvement_candidates`、`rollout_records` 等新事实对象时，contract 和Status机必须先defines清楚 authoritative 责任，再扩展持久化实现。

后续升级要求：

- 若迁移 PostgreSQL，不得让业务 contract 漂移；应优先替换 storage adapter / migration / queue 层，而不is重写业务主链

## 结果

优点：

- 本地开发和测试成本最低。
- 最适合当前阶段快速建立可恢复、可审计的最小平台闭环。
- vs当前单机 contract 体系天然对齐。

代价：

- concurrent和扩展性有明确upper limit。
- Phase 2 以后若能力继续扩张，必须认真规划迁移，不可no限拖延。

## 当前实现对齐

截至当前 phase1-4 交付，本 ADR 的现实含义变为：

- `harness_runs / node_runs / node_attempt_receipts / approvals / events / diagnostics` 等事实仍然由 SQLite 边界托底。
- OAPEFLIR 认知 DTO、LearningObject、ReleaseDecisionView 等新对象已via先在class型、测试和 contract 层收口，再逐步往持久化扩展。
- 这意味着“先defines authoritative 语义，再补storage形态”，而不is先references入第二套data平面。

## v4.3 ADR Remediation

- A-4: 本 ADR 原先延续 task/workflow/execution-centric storage叙事，Root cause:  SQLite Decision形成时 runtime truth 仍以旧对象命名为主，后续没有随着 `NodeRun` / `NodeAttemptReceipt` 主链完成统一迁移。修复：正文现明确 SQLite authoritative truth 主语为 `harness_runs / node_runs / node_attempt_receipts`，旧 task/workflow/execution 只保留为兼容叙事。

## 交叉references用

- [ADR-009 部署vs运维](./009-deployment-ops.md)
- [ADR-013 EventEmitter isno继续uses到 Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-011 Effect-TS isno作为核心运lines时基础](./011-effect-ts-adoption.md)

## 来源章节

- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `state_transition_matrix_contract.md`
- `data_plane_contract.md`
