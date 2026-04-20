# Automatic Agent Platform 中文文档入口

`docs_zh/` 现在按“用途”而不是“历史来源”组织，顶层只保留目录入口，不再堆放零散总纲文件。

## 推荐阅读顺序

1. 先读 [architecture/00-platform-architecture.md](./architecture/00-platform-architecture.md)
2. 再读 [migration/00-migration-guideline.md](./migration/00-migration-guideline.md)
3. 然后读 [migration/01-migration-scope.md](./migration/01-migration-scope.md)
4. 需要看规范时进入 [contracts/README.md](./contracts/README.md) 和 [adr/README.md](./adr/README.md)
5. 需要落地执行时进入 [operations/README.md](./operations/README.md)

## 目录说明

| 目录 | 作用 | 是否事实源 |
| --- | --- | --- |
| [architecture/](./architecture/README.md) | 平台骨架、代码结构、架构参考、时序与图示 | `是` |
| [migration/](./migration/README.md) | 迁移原则、迁移范围 | `是` |
| [contracts/](./contracts/README.md) | authoritative contract、协议、状态机、对象边界 | `是` |
| [adr/](./adr/README.md) | 架构决策记录 | `是` |
| [governance/](./governance/README.md) | 长期治理规则、术语、命名与变更规则 | `是` |
| [guides/](./guides/quickstart.md) | 上手和编写指南 | `是` |
| [operations/](./operations/README.md) | 当前执行、验证、运行与运维文档 | `是` |
| [quality/](./quality/README.md) | 测试手册、发布清单 | `是` |
| [analysis/](./analysis/README.md) | 覆盖矩阵、代码库对照审查等辅助分析 | `否` |

## 命名与编号规则

- 面向阅读入口的文档统一使用 `00-`, `01-`, `02-` 递增编号。
- ADR 继续保留原有 ADR 编号，不混入顶层阅读编号。
- contract 保持语义化命名，不引入额外序号。
- 分析类文档进入 `analysis/`，不再以 `reviews/` 形式混入正式入口。

## 当前约束

- `architecture/00-platform-architecture.md` 是系统骨架的唯一上位设计源。
- `analysis/` 只做辅助判断，不替代架构、contract、ADR。
- 不再把历史 review、归档、一次性 gap 文档当作正式入口。
