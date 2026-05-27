# Platform Architecture 权威入口

> 2026-05-27 复核：本文件是“架构入口索引”，不是回退到单体大文档的占位 stub。

## 1. 当前权威矩阵

| 你要确认的问题 | 权威入口 |
| --- | --- |
| 平台总览、阅读顺序 | [README.md](./README.md) |
| 模块结构与平面边界 | [01-code-structure.md](./01-code-structure.md)、[03-module-diagrams.md](./03-module-diagrams.md) |
| 运行时时序 | [04-runtime-sequence.md](./04-runtime-sequence.md) |
| UI / 多端边界 | [05-cross-platform-ui-architecture.md](./05-cross-platform-ui-architecture.md) |
| 规范对象与协议边界 | [../contracts/README.md](../contracts/README.md) |
| 历史与决策演进 | [../adr/README.md](../adr/README.md) |
| 当前差距与整改状态 | [../reviews/platforme-full-review-b.md](../reviews/platforme-full-review-b.md) |

## 2. 当前工程命名基线

- 平台主核：`five-plane-interface`、`five-plane-control-plane`、`five-plane-orchestration`、`five-plane-execution`、`five-plane-state-evidence`
- 横切能力：`shared`、`contracts`、`model-gateway`、`prompt-engine`、`compliance`
- 上层能力：`domains`、`interaction`、`org-governance`、`scale-ecosystem`、`ops-maturity`

## 3. 使用规则

- 需要“大图”时先读本入口，再跳转到专题文档，不再把单一文件当作全量事实源。
- 当前实现闭环必须回到 review 表或 contract/ADR，不在入口页重复维护行级问题。
- 历史单体架构文档只保留在 archive，用于追溯，不作为当前权威入口。
