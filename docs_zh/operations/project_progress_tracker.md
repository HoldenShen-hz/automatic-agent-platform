# Project Progress Tracker

> Last updated: 2026-04-18
> 本文件只维护当前进度快照。
> 不再保留历史流水账入口，只保留当前有效状态。

## 1. 总体状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 文档体系 | `done` | phase1-4 对应 `contract / ADR / governance / operations / active docs` 已按 `§K` 完成同步 |
| Phase 1a | `pending_long_duration_evidence` | 开发完成，待 `72h` 证据收口 |
| Phase 1b | `pending_long_duration_evidence` | 开发完成，随 Stable Core 证据一起收口 |
| Phase 2a | `done` | 开发工作包完成 |
| Phase 2b | `done` | 开发工作包完成 |
| Phase 2c | `done` | 开发工作包完成 |
| Phase 3 | `done` | 开发工作包完成 |
| Phase 4 | `done` | 开发工作包完成 |
| Stable Core 验证 | `in_progress` | `72h` 已于 `2026-04-17` 重新起跑并完成首个 segment，仍在继续 |
| 工业级生产就绪 | `blocked_on_external_infra` | `PG` 与 `registry publish` 已完成，当前只剩目标部署环境 secret/binding 联调 |

## 2. 当前结论

- 当前仓库的主要剩余工作不是功能扩张，而是稳定性证据与最后一层外部部署基础设施联调。
- `2026-04-17` 已重新启动 fresh `72h` wall-clock campaign，并已在 `data/stable-evidence/72h/` 落下首个通过 segment 的 state/report；当前剩余只是继续累计 wall-clock 时长，而不是再补证据框架。
- 同日已导出新的 acceptance readiness 工件到 `data/artifacts/acceptance_readiness/`，将 4 个活跃尾项的最新阻塞固化为 JSON/Markdown 证据。
- `IND-P0-01` 已完成：`2026-04-17` 在 fresh PG 样本库 `agent_company_os_pgvector_readiness_v4` 上完成 `CREATE EXTENSION vector` 后，`knowledge-semantic-readiness` 返回 `ready=true`，并通过 pgvector semantic roundtrip。
- `IND-P0-09` 已完成：`2026-04-17` 真实远端 `Publish Docker Image` run `24544905061` 成功完成，`Build and push` 全链路通过。
- `IND-P0-10` 现已被压缩到最终外部阻塞：`2026-04-17` 真实远端 `Deploy to Environment` run `24544905569` 已成功等待镜像出现，随后在 `deployment-preflight` 明确失败于 GitHub environment secrets `AWS_DEPLOY_ROLE_ARN`、`AWS_REGION`、`EKS_CLUSTER_NAME` 缺失。
- OAPEFLIR / reference-new-requirement 当前 revision 的仓库内实现项已完成，并已在 `2026-04-18` 通过最终回归验证：
  - `npm run build`
  - `npm run typecheck`
  - `node --test --test-concurrency=12 "dist/tests/**/*.test.js"` → `10606 / 10600 / 0 / 6`
  - `npm run coverage:gate`
  - `Observe` 复用 `observability/`，未额外创建 `observe/`
  - `Assess / Plan / Feedback / Learn / Improve` 已形成独立目录与测试
  - `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` baseline 已落地，并已补齐 unit / targeted integration 回归
- `Phase 2 / Phase 3 / 深化篇 / 长期 rollout` 对应的仓库内实现项也已纳入完成确认，详细证据以当前仓库的 contract / ADR / tests / artifact 为准。
- 上述四个 M2 子系统本轮又继续向运行时主路径推进：
  - `api-server` 已从 config 层 bootstrap domain / plugin manifest / knowledge namespace
  - Knowledge Plane 已具备本地 snapshot 持久化恢复
  - Artifact Plane 已具备 publish ledger 与 API/OpenAPI 暴露
  - Knowledge Plane 已补齐 semantic graph baseline 与 graph inspect API
  - Knowledge Plane 已补齐 graph-aware retrieval ranking 与 reasoning signals
  - Knowledge Plane 已补齐 lightweight local embedding/vector recall baseline
  - Knowledge Plane 已新增 `SemanticVectorStore(local_hash|pgvector)` 抽象、async semantic retrieval 与 PostgreSQL `knowledge_semantic_vectors` / pgvector migration
  - Knowledge Plane 已补齐 semantic startup fail-close、snapshot restore vector rehydrate、`GET /v1/knowledge/semantic/inspect` 与 `knowledge-semantic-readiness` PG/pgvector readiness CLI
  - domain / plugin / knowledge 事件已接入 typed event bus
  - domain / plugin / knowledge 事件已补齐 feedback consumer bridge
  - Plugin SPI 已具备 timeout、namespace sandbox、degraded/disabled 与 error isolation 基线
  - Plugin SPI 已补齐 activation dedupe、serial invocation isolation、queue overflow guard 与 invocation runtime telemetry
  - Plugin SPI 已显式暴露 `runtimeIsolation(shared_process|serialized_in_process|forked_process|sandboxed_process|containerized_process)`、`cooldownMs` / `cooldownUntil` / `runtimeProcessId` / `runtimeSandboxRoot`，并发布 `plugin:invocation_started|plugin:invocation_completed` typed audit 事件
  - Plugin SPI 已补齐 `retriever / presenter / adapter` capability-specific isolated invoke path
  - Plugin SPI 已为 builtin plugin 提供 forked + sandboxed + launcher-based containerized subprocess runtime 基线；真实 container / microVM 级编排仍不应被表述为已完成
- phase1-4 对应的 `contract / ADR / governance / operations / active docs` 已完成同步；当前剩余工作不再包含这四个 baseline 子系统
- 进入真实生产前，以当前 `quality/` 清单、`operations/` runbook 与验收工件为准。
- 历史里程碑、旧测试计数和完整推进流水账已移入归档，避免继续污染活跃进度视图。

## 3. 当前剩余里程碑

| 里程碑 | 状态 | 退出条件 |
| --- | --- | --- |
| `Stable Core 72h evidence` | `in_progress` | `2026-04-17` 已重新启动 fresh wall-clock 采证，当前需继续累计直到完整 `72h` |
| `DOC-OAPEFLIR-01` contract / ADR / governance 同步 | `done` | `§K` 对应的 contract / ADR / governance 已完成收口 |
| `DOC-OAPEFLIR-02` operations / active docs 同步 | `done` | `§K` 对应的活跃文档收口已完成 |
| `IND-P0-01` PostgreSQL 联调 | `done` | fresh PG `agent_company_os_pgvector_readiness_v4` 已通过 pgvector readiness 与 semantic roundtrip |
| `IND-P0-09` registry / CI-CD 联调 | `done` | 远端 publish run `24544905061` 已真实成功 |
| `IND-P0-10` 多环境部署联调 | `blocked` | 当前仅差 GitHub environment secrets `AWS_DEPLOY_ROLE_ARN`、`AWS_REGION`、`EKS_CLUSTER_NAME` |

## 4. 相关入口

- 阶段计划：[implementation_plan.md](./implementation_plan.md)
- 路线图：[operations-roadmap.md](./operations-roadmap.md)
- 发布与执行检查：[operations-checklist.md](./operations-checklist.md)
