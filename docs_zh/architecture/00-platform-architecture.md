# Platform Architecture Index

> 2026-05-14 复核：历史 711KB 单体架构文档已归档到 `docs_zh/architecture/archive/00-platform-architecture-monolith-2026-05-14.md`。本文件保留为短索引，避免架构入口继续承载不可审计的超大正文。
>
> 2026-05-26 同步：接口层、联邦治理、事件可靠性、Electron/UI 契约已按当前代码回写到正式文档；最新系统级证据见 `docs_zh/reviews/system-review-2026-05-26.md`。

## 当前阅读入口

- 架构目录说明：`docs_zh/architecture/README.md`
- Design review 问题表：`docs_zh/reviews/issues-table.md`
- 实现一致性审计：`docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`
- 合同文档：`docs_zh/contracts/`
- ADR：`docs_zh/adr/`

## 维护规则

- 新增架构内容优先落到专题文档或 ADR，不再扩写本索引为单体文档。
- 需要引用历史全文时，链接归档文件并在 review 表记录原因。
- 架构实现闭环以 `issues-table.md` 行级证据和 `scripts/ci/audit-review-batch-resource-contracts.mjs` 审计结果为准。
- 历史 `five-plane-*` 目录名、旧 “CEO/VP/事业部” 叙事和 v2.x 分层表述只作为兼容检索入口；当前工程命名以 `P1-P5 + X1`、`DomainDescriptor`、`HarnessRun/NodeRun` 为准。
- 当前公共 UI 数据源以 Layer C `/v1/*` 契约为准，不再把 `/admin/*` 当作默认前端公共接口。
