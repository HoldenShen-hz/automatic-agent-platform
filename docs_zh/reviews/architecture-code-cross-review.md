# Architecture Code Cross Review

> 维护日期：2026-05-27
> 作用：保留“架构与源码交叉审查”结论，但必须附带当前证据入口。

## 当前收口方式

| 主题 | 当前证据 |
| --- | --- |
| 架构入口与目录边界 | [../architecture/00-platform-architecture.md](../architecture/00-platform-architecture.md)、[../contracts/README.md](../contracts/README.md) |
| review 问题闭环 | [platforme-full-review-b.md](./platforme-full-review-b.md) |
| 结构性一致性审计 | [platform-architecture-implementation-consistency-audit.md](./platform-architecture-implementation-consistency-audit.md) |
| 文档同步 | `node scripts/ci/audit-docs-sync.mjs` |

## 审查规则

- 不再写“24 项全部关闭”这类无证据总结。
- 每个已关闭结论必须能回指到具体文档、命令或源码修复。
- 长期治理项保留在 review 总表，不在这里伪装成一次性关闭。
