# ADR 090: Runtime, Data Reliability, and Operations

- Status：Accepted
- Decision日期：2026-04-20

## Background

`§20`、`§24`-`§32`、`§33`、`§36` defines了长时任务、configure治理、data一致性、storage、性能 SLO、event / projection / DLQ、knowledge / memory / artifact、HA、部署和路线图。这些章节共同构成生产运lines基础，但过去 ADR 多按单点技术选型record，缺少一个面向长期运lines的统一Decision。

## Decision

平台 runtime vsdata可靠性采用以下统一principle：

- 长时任务必须具备休眠、唤醒、TTL、lease / fencing、恢复和人工接管能力。
- configure必须分层、版本化、可灰度、可审计，不允许运lines时散落configure。
- Truth table、event log、projection、artifact、audit is同一 State & Evidence Plane 的不同投影。
- Projection 必须可重建；DLQ 必须可诊断、可重放、可升级 incident。
- HA、backup、restore、deployment promotion 必须vs readiness / promote criteria contract 对齐。
- 路线图和success标准is architecture governance 的一部分，不能作为临时 TODO 混入 contract。

## 取舍

- 不把 projection 当 authoritative state。
- 不允许只靠日志恢复关键 workflow。
- 不允许部署和configure变化bypassing release / readiness / promote criteria。

## Impact

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

- `src/platform/five-plane-execution/*`
- `src/platform/five-plane-state-evidence/*`
- `src/platform/shared/stability/*`
- `src/platform/five-plane-control-plane/config-center/*`
- `config/*`

## 测试要求

- unit tests：state transition、lease/fencing、config resolution、projection rebuild。
- integration tests：long-running workflow、DLQ replay、startup recovery、release readiness。
- contract tests：no lease、no evidence、no readiness 的执lines或部署不得进入生产链。
