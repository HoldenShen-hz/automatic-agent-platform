# 全面清理审查

> 维护日期：2026-05-27
> 本文件用于说明“全仓清理”类问题的当前治理边界，不再保留过期的个人扫描报告。

## 当前治理范围

| 类别 | 当前口径 |
| --- | --- |
| 文档清理 | 通过 `audit-docs-sync`、review 总表、专题文档索引收口 |
| 测试产物清理 | 通过 `.gitignore`、质量审计文档、定向清理规则收口 |
| 部署/构建产物清理 | 通过 `Dockerfile`、`docker-compose.yml`、`deploy/` 配置同步收口 |
| 历史归档 | 保留在 `docs_zh/operations/archive/` 与 `docs_zh/architecture/archive/`，不作为当前事实源 |

## 不再使用的写法

- 个人绝对路径
- 机器特定的磁盘占用统计
- 一次性 `rm -rf` 清单直接冒充长期规范

## 当前事实源

- [platforme-full-review-b.md](./platforme-full-review-b.md)
- [../operations/current_todo_list.md](../operations/current_todo_list.md)
- [../operations/review-closure-board.md](../operations/review-closure-board.md)
