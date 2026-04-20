# Phase 4 Enterprise Ecosystem

## 1. 目标

把平台从 PMF 产品推进到可持续商业模式，覆盖企业能力、生态扩展和规模化运营。

补充边界：

- 当前仓库里 `Phase 4 = done` 指的是企业治理、组织能力、规模化运维与生态治理 baseline 已完成。
- `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` baseline 已在后续实现中单独落地，且已继续补齐 config-backed bootstrap、knowledge snapshot、artifact publish ledger、semantic graph、graph-aware retrieval ranking、lightweight semantic vector recall、domain events、domain feedback consumer、plugin sandbox/error isolation、plugin serial invocation isolation、capability-specific plugin invoke paths，以及 `runtimeIsolation` / `cooldownMs` / `cooldownUntil` / `runtimeProcessId` / `runtimeSandboxRoot` 与 `plugin:invocation_started|completed` 审计事件，并为 builtin plugin 提供 `forked_process`、`sandboxed_process` 与 `containerized_process` launcher-based isolated runtime host，同时为 Knowledge Plane 提供 `SemanticVectorStore(local_hash|pgvector)`、PostgreSQL `knowledge_semantic_vectors` migration 与 `knowledge-semantic-readiness` readiness CLI；但真实 PG/pgvector 与 container-grade runtime 的 live infra 验证仍不计入当前 `Phase 4` 完成定义。

## 2. 进入条件

- Phase 3 已验证收费、基础产品价值和主动能力边界
- tenant / org / metering / enterprise ops / ecosystem contract 已稳定
- 工业级生产托底能力已有明确实现路线
- 进入 4 前已重新通过 `operations-checklist.md` 的当前阶段签收

## 3. 必做范围

- Enterprise 私有化与治理能力增强。
- 团队、组织、审计、权限与合规能力增强。
- Marketplace / 插件生态治理 baseline。
- 多租户或组织级隔离能力。
- 运维、支持、升级和 SLA 体系。

## 4. 非目标

- 不受控的开放扩展。
- 没有审计与权限模型的第三方接入。
- 不把 `M2` 的完整 extension plane 误记为当前 `Phase 4` 已交付。

## 5. 关键 contract / 主文档

- [tenant_and_organization_contract.md](../../contracts/tenant_and_organization_contract.md)
- [tenant_isolation_and_shared_worker_safety_contract.md](../../contracts/tenant_isolation_and_shared_worker_safety_contract.md)
- [enterprise_operations_plane_contract.md](../../contracts/enterprise_operations_plane_contract.md)
- [ecosystem_extension_plane_contract.md](../../contracts/ecosystem_extension_plane_contract.md)
- [supply_chain_and_dependency_security_contract.md](../../contracts/supply_chain_and_dependency_security_contract.md)
- [environment_and_configuration_governance_contract.md](../../contracts/environment_and_configuration_governance_contract.md)
- [remote_coordination_and_disaster_recovery_contract.md](../../contracts/remote_coordination_and_disaster_recovery_contract.md)
- [operations-roadmap.md](../operations-roadmap.md)
- [operations-checklist.md](../operations-checklist.md)

## 6. 核心交付物

- Enterprise 版本能力矩阵。
- Marketplace / extension governance baseline。
- 组织级运维与 SLA 文档。
- Phase 4 规模化运营基线。

## 7. 验收与退出门槛

- 企业客户可用性、可审计性、可治理性达标。
- 生态扩展不会破坏平台安全边界。
- 商业模式可持续。
- 当前阶段涉及模块已满足 `operations-checklist.md` 中对应的“当前阶段可验收”标准。

## 8. 风险与控制点

- 风险：生态开放速度快于安全与审计治理。
- 控制：所有扩展先经过 capability、review、rollback 与 revoke 机制。
- 风险：多租户与 shared worker 交叉污染。
- 控制：tenant isolation 与 secret scope 必须优先于大规模开放。

## 9. 向下一阶段交接

- Phase 4 是当前路线图的规模化阶段，不再向后隐式追加“未定义平台层”。
- 新的长期能力若出现，应先走 ADR + contract，再进入新 roadmap。
