# ADR-012 SQLite 是否作为 Phase 1-2 唯一主存储

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

平台当前还处于 Phase 1a / 1b 的基础闭环阶段，优先目标是把任务、workflow、execution、approval、event、session、recovery 路径跑稳，而不是一开始就上分层数据平面或多租户事务基础设施。

需要决策的问题是：

- Phase 1a / 1b 是否继续以 SQLite 作为默认主事务存储。
- 何时必须退出这一决策。

## 决策

Phase 1a 与 Phase 1b 继续以 SQLite 作为默认 / 首选主事务存储。

同时明确边界：

- SQLite 继续承担当前阶段最主要的单机 authoritative 事务存储。
- PostgreSQL 后端可以作为受控替代实现存在，用于双写演练、并发验证和后续迁移准备，但不得绕过既有 storage contract。
- artifact 主体仍可存文件系统或对象存储，但索引和事实状态以 SQLite 为准。
- 进入更复杂的数据平面后，再按 `data_plane_contract.md` 演进为分层存储。
- OAPEFLIR 新增的 `TaskSituation / Assessment / Plan / Feedback / Learning / Improvement / Rollout` 等事实对象，在当前阶段仍与既有任务事实一起受 SQLite authoritative 边界约束。

## 备选方案

### 方案 A：当前阶段直接采用 PostgreSQL

优点：

- 并发能力更强。
- 更接近未来多租户 / 多 worker 形态。

代价：

- 本地开发、测试、发布和运维复杂度显著增加。
- 现在的主风险不是 DB 上限，而是 contract 尚未完全映射到代码。
- 早期会把大量精力耗在基础设施而不是产品闭环上。

### 方案 B：SQLite + 其他缓存/队列混合方案

优点：

- 可局部缓解写入压力。

代价：

- 系统复杂度上升，但真正的问题边界可能仍未收紧。
- 会过早引入多种 authoritative 来源。

### 方案 C：当前决策方案

- SQLite 继续作为唯一主事务存储
- 明确并发、背压和 Phase 边界
- 后续再通过 ADR 和 contract 正式升级

## 选择这个方案的原因

- 当前阶段最需要的是低运维成本、高可复制性和本地可调试性。
- SQLite 足以支撑 Phase 1a / 1b 的单机闭环。
- 现在先把状态、事件、审批、恢复和存储 schema 收紧，比提前上更重数据库更关键。
- 项目已经有清晰的数据平面演进文档，不会因为当前选择 SQLite 就丢掉后续升级路径。

## 关键不变量

- SQLite 是当前默认 authoritative 事务源。
- 若启用 PostgreSQL，必须通过受控 storage adapter / migration / dual-run 方案接入，不能形成未受治理的第二套业务语义。
- `foreign_keys = ON` 是正式运行要求，不是可选优化。
- 高价值事实状态不得只存在内存。
- 不允许把“SQLite 未来会迁移”当成当前可忽略一致性的借口。
- OAPEFLIR 演化实体即使暂时由轻量服务或内存注册表托管，也必须能映射回 SQLite authoritative 事实边界，不能形成不受治理的第二真相源。

## 采用触发条件

只要系统仍满足以下条件，就继续维持本决策：

- 单机为主
- Phase 1a / 1b 主链为主
- 并发规模仍受控
- 多租户、远程 worker、分析平面尚未进入正式实现

## 退出条件

出现以下任一情况，应重新决策：

- execution plane 进入多 worker / queue / lease 主体实现
- 单机写入瓶颈成为持续问题，且背压/异步批量已不足以缓解
- 多租户或 enterprise 事务隔离正式进入实现范围
- analytics / archive / replay 需要独立数据平面

## 实施影响

当前必须配套做到：

- schema、migration、repository 和恢复巡检都按 SQLite 边界设计
- FileLock、event ack、execution、approval 都落到 SQLite authoritative 表
- 通过背压和运行约束控制超阶段并发
- 当 phase1-4 引入 `learning_objects`、`improvement_candidates`、`rollout_records` 等新事实对象时，contract 和状态机必须先定义清楚 authoritative 责任，再扩展持久化实现。

后续升级要求：

- 若迁移 PostgreSQL，不得让业务 contract 漂移；应优先替换 storage adapter / migration / queue 层，而不是重写业务主链

## 结果

优点：

- 本地开发和测试成本最低。
- 最适合当前阶段快速建立可恢复、可审计的最小平台闭环。
- 与当前单机 contract 体系天然对齐。

代价：

- 并发和扩展性有明确上限。
- Phase 2 以后若能力继续扩张，必须认真规划迁移，不可无限拖延。

## 当前实现对齐

截至当前 phase1-4 交付，本 ADR 的现实含义变为：

- 主任务、执行、审批和诊断事实仍然由 SQLite 边界托底。
- OAPEFLIR DTO、LearningObject、Rollout 等新对象已经先在类型、测试和 contract 层收口，再逐步往持久化扩展。
- 这意味着“先定义 authoritative 语义，再补存储形态”，而不是先引入第二套数据平面。

## 交叉引用

- [ADR-009 部署与运维](./009-deployment-ops.md)
- [ADR-013 EventEmitter 是否继续使用到 Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-011 Effect-TS 是否作为核心运行时基础](./011-effect-ts-adoption.md)

## 来源章节

- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `state_transition_matrix_contract.md`
- `data_plane_contract.md`
