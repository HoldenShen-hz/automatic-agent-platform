# Analysis

`analysis/` 存放辅助分析文档，帮助判断覆盖度和一致性，但不是上位事实源。

## 文件顺序

1. [00-architecture-coverage-matrix.md](./00-architecture-coverage-matrix.md)
   架构章节到 ADR / contract / src / tests 的覆盖矩阵。
2. [01-codebase-vs-design-review.md](./01-codebase-vs-design-review.md)
   当前代码库与设计的对照审查。

## 使用原则

- `analysis/` 只用于辅助判断，不替代 `architecture/`、`contracts/`、`adr/`。
- 若分析结论和平台骨架冲突，以 `architecture/00-platform-architecture.md` 为准。
