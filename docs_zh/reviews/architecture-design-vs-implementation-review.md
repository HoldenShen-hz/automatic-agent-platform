# 架构设计 vs 代码实现评审

> 维护日期：2026-05-27
> 作用：为 `docs_zh/operations/implementation_plan.md` 提供可复核的设计/实现对账入口，而不是占位说明。

## 当前结论

- 架构入口已切换为索引式治理：`docs_zh/architecture/00-platform-architecture.md` 负责入口矩阵，细节落在 `architecture/`、`contracts/`、`adr/`。
- 实现一致性问题以 review 表逐项收口，不再在本文件重复维护“大而全清单”。
- 巨型治理项与一次性修复项已拆分：结构问题进入 `platforme-full-review-b.md`，长期演进项进入 operations 文档。

## 核对证据

- 架构入口：[../architecture/00-platform-architecture.md](../architecture/00-platform-architecture.md)
- 实现一致性审计：[platform-architecture-implementation-consistency-audit.md](./platform-architecture-implementation-consistency-audit.md)
- 当前问题总表：[platforme-full-review-b.md](./platforme-full-review-b.md)
- contracts 索引：[../contracts/README.md](../contracts/README.md)

## 回归命令

```bash
node scripts/ci/audit-docs-sync.mjs
node scripts/ci/audit-review-large-source-examples.mjs
```
