# Architecture Archive

`archive/` 用来保留“曾经作为正式入口”的历史架构快照，以及“当前正式架构的归档快照”。

## 当前文件

1. [00-platform-architecture-monolith-2026-05-14.md](./00-platform-architecture-monolith-2026-05-14.md)
   2026-05-14 的单体架构全文归档，保留历史章节、原始叙事和迁移上下文。
2. [01-platform-architecture-current-snapshot-2026-05-26.md](./01-platform-architecture-current-snapshot-2026-05-26.md)
   2026-05-26 的最新归档快照，反映当前“拆分文档 + 当前实现状态”的权威入口。

## 使用规则

1. 需要看当前系统，先读 `01-platform-architecture-current-snapshot-2026-05-26.md`，再跳转到 `../` 下对应正式文档。
2. 需要核对历史设计、迁移来源或 review 争议背景，再读 `00-platform-architecture-monolith-2026-05-14.md`。
3. `archive/` 中的文档不替代 `docs_zh/architecture/` 正式目录，但必须保持“可追溯、可比对、可落到当前实现”的状态。
