# Platform Architecture Current Snapshot

> **快照日期**：2026-05-26
> **快照性质**：最新归档快照
> **对应当前正式目录**：`docs_zh/architecture/`
> **用途**：为后续 review、审计、迁移和大版本重构保留一份“当前架构入口 + 当前实现状态”的稳定归档

---

## 1. 当前权威入口

当前平台不再维护单一超大架构正文，而是采用“总索引 + 专题文档”结构：

1. [../00-platform-architecture.md](../00-platform-architecture.md)
   顶层索引与阅读入口。
2. [../01-code-structure.md](../01-code-structure.md)
   代码目录、模块边界、主干分层。
3. [../03-module-diagrams.md](../03-module-diagrams.md)
   模块结构图、关系图和分层图。
4. [../04-runtime-sequence.md](../04-runtime-sequence.md)
   关键运行时序列与主链路。
5. [../05-cross-platform-ui-architecture.md](../05-cross-platform-ui-architecture.md)
   跨平台 UI 架构与六端壳层。

---

## 2. 当前架构口径

### 2.1 上位设计源

- 当前唯一上位设计入口是 `docs_zh/architecture/00-platform-architecture.md`。
- 详细结构不再堆叠进一份 monolith 文档，而是拆到专题文档。
- 历史大文档只保留为归档，不再直接驱动新增实现。

### 2.2 平台主骨架

- 后端仍以 `P1-P5 + X1` 五平面加横切治理骨架为主：
  - `P1` Interface Plane
  - `P2` Control Plane
  - `P3` Orchestration Plane
  - `P4` Execution Plane
  - `P5` State & Evidence Plane
  - `X1` 横切治理/稳定性/可观测能力
- 运行时权威对象继续以 `HarnessRun / NodeRun / SideEffect / Event / Budget / Mission` 为主轴。
- UI 侧按 `ui/` Monorepo、shared core、feature packages、六平台 shell 拆分。

### 2.3 当前实现已经明确收敛的关键口径

1. UI 公共查询层不再以 `/admin/*` 作为默认公共契约，已补齐 Layer C 公共入口：
   - `/v1/workers`
   - `/v1/queues`
   - `/v1/agents`
   - `/v1/dashboard/metrics`
   - `/v1/explanations`
   - `/v1/meta/contract-version`
2. 前端 endpoint catalog 已统一为 `/v1/*`，由 runtime `baseUrl=/api` 拼接成 `/api/v1/*`。
3. `FederationAudit`、`TrustRelationship` 已从纯内存规格承诺收敛为持久化实现。
4. `DurableEventBusAsync` 的异步失败吞错问题已修复，Tier-1 失败重新回到主链处理。
5. Electron bridge 已统一兼容 `AA_ELECTRON` 和 `__AA_ELECTRON__`。

---

## 3. 当前正式文档与实现映射

| 主题 | 正式文档 | 当前实现主路径 |
|---|---|---|
| 顶层架构索引 | [../00-platform-architecture.md](../00-platform-architecture.md) | `src/`、`ui/`、`docs_zh/reviews/` |
| 代码结构与模块边界 | [../01-code-structure.md](../01-code-structure.md) | `src/platform/`、`src/domains/`、`src/interaction/`、`src/scale-ecosystem/`、`src/ops-maturity/` |
| 模块关系图 | [../03-module-diagrams.md](../03-module-diagrams.md) | `src/platform/**`、`ui/packages/**` |
| 运行时序列 | [../04-runtime-sequence.md](../04-runtime-sequence.md) | `src/platform/five-plane-orchestration/`、`src/platform/five-plane-execution/`、`src/platform/five-plane-state-evidence/` |
| 跨平台 UI | [../05-cross-platform-ui-architecture.md](../05-cross-platform-ui-architecture.md) | `ui/apps/`、`ui/packages/shared/`、`ui/packages/features/` |

---

## 4. 与 2026-05-14 单体归档版的差异

| 维度 | 2026-05-14 单体版 | 2026-05-26 当前快照 |
|---|---|---|
| 文档组织方式 | 一份超大 monolith 文档承载全部叙事 | 入口索引 + 专题文档 + review 证据回写 |
| 前后端契约描述 | 更多是规格目标与目标 API 表 | 更强调“当前真实路由、OpenAPI、endpoint catalog、测试证据”一致 |
| 审计与治理 | 大量能力以设计承诺表达 | 多项能力已补齐为真实实现并有定向测试 |
| UI 结构 | 以规划为主 | `ui/` Monorepo 与多平台壳层已经落库 |
| review 收口方式 | 以章节目标和 roadmap 为主 | 以 review 文档、问题台账、测试和实现证据闭环 |

---

## 5. 当前状态证据入口

1. 系统级问题与修复回写：
   [../../reviews/system-review-2026-05-26.md](../../reviews/system-review-2026-05-26.md)
2. 当前架构目录说明：
   [../README.md](../README.md)
3. 当前实现一致性与问题台账：
   `docs_zh/reviews/`
4. 当前 OpenAPI 与 HTTP 导出面：
   - `src/platform/five-plane-interface/api/openapi-document.ts`
   - `src/platform/five-plane-interface/api/http-server/`

---

## 6. 归档维护规则

1. 每次顶层架构入口发生明显形态变化时，`archive/` 需要追加新的快照，而不是覆盖旧文件。
2. 新快照要描述“当前正式文档入口 + 当前实现状态 + 与上一代快照的关键差异”。
3. 旧快照继续保留，不因为当前实现变化而删除历史内容。
