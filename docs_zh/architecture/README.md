# Architecture

`architecture/` 收口“平台是什么”这一层的正式文档，按阅读顺序编号。

## 文件顺序

1. [00-platform-architecture.md](./00-platform-architecture.md)
   系统骨架与总设计，唯一上位设计源。
2. [01-code-structure.md](./01-code-structure.md)
   代码目录与模块边界设计。
3. [02-code-architecture-reference.md](./02-code-architecture-reference.md)
   从旧系统迁移过来的代码架构参考，保留为新平台的结构基线参考。
4. [03-module-diagrams.md](./03-module-diagrams.md)
   模块图、关系图和结构图示。
5. [04-runtime-sequence.md](./04-runtime-sequence.md)
   关键运行时序列和主链路图。

## 使用原则

- 先看 `00`，再看 `01`，最后按需进入 `02-04`。
- 若 `02-04` 与 `00` 冲突，以 `00` 为准。
- 本目录不放执行追踪、一次性 review 或临时 TODO。

## 最近同步

- 2026-05-14：`docs_zh/reviews/issues-table.md` 中的架构/实现一致性问题以本目录 README 为索引入口重新挂接；具体代码级修复证据仍记录在 review 表对应行和 `scripts/ci/audit-review-batch-resource-contracts.mjs`。
- 大型结构项（巨型文件拆分、符号链接迁移、全局类型逃逸清理）不在 `00-platform-architecture.md` 内伪装为已完成，继续按治理边界和后续拆分计划推进。
