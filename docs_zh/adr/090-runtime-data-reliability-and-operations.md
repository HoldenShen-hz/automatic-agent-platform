# ADR 090: Runtime, Data Reliability, and Operations

## 状态

Accepted

## 日期

2026-04-20

## 背景

`§20`、`§24`-`§32`、`§33`、`§36` 定义了长时任务、配置治理、数据一致性、存储、性能 SLO、event / projection / DLQ、knowledge / memory / artifact、HA、部署和路线图。这些章节共同构成生产运行基础，但过去 ADR 多按单点技术选型记录，缺少一个面向长期运行的统一决策。

## 决策

平台 runtime 与数据可靠性采用以下统一原则：

- 长时任务必须具备休眠、唤醒、TTL、lease / fencing、恢复和人工接管能力。
- 配置必须分层、版本化、可灰度、可审计，不允许运行时散落配置。
- Truth table、event log、projection、artifact、audit 是同一 State & Evidence Plane 的不同投影。
- Projection 必须可重建；DLQ 必须可诊断、可重放、可升级 incident。
- HA、backup、restore、deployment promotion 必须与 readiness / promote criteria contract 对齐。
- 路线图和成功标准是 architecture governance 的一部分，不能作为临时 TODO 混入 contract。

## 取舍

- 不把 projection 当 authoritative state。
- 不允许只靠日志恢复关键 workflow。
- 不允许部署和配置变化绕过 release / readiness / promote criteria。

## 影响

对应 authoritative contracts：

- `lifecycle_and_termination_contract.md`
- `task_lease_and_fencing_contract.md`
- `configuration_layers_and_defaults_contract.md`
- `environment_and_configuration_governance_contract.md`
- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `production_storage_and_queue_contract.md`
- `artifact_store_contract.md`
- `artifact_unified_model_contract.md`
- `event_reliability_matrix_contract.md`
- `debug_inspect_health_backpressure_contract.md`
- `ha_coordinator_and_leader_election_contract.md`
- `remote_coordination_and_disaster_recovery_contract.md`
- `environment_readiness_registry_contract.md`
- `platform_promote_criteria_contract.md`

对应实现边界：

- `src/platform/execution/*`
- `src/platform/state-evidence/*`
- `src/platform/shared/stability/*`
- `src/platform/control-plane/config-center/*`
- `config/*`

## 测试要求

- unit tests：state transition、lease/fencing、config resolution、projection rebuild。
- integration tests：long-running workflow、DLQ replay、startup recovery、release readiness。
- contract tests：无 lease、无 evidence、无 readiness 的执行或部署不得进入生产链。
