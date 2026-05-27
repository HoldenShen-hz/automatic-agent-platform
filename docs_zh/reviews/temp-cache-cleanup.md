# 临时缓存清理审查

> 维护日期：2026-05-27
> 本文件只保留当前治理口径，不再记录个人机器路径或一次性扫描快照。

## 当前清理对象

- `.test-db/`：测试数据库产物
- `.audit/`：审计输出
- `.runtime/`：本地运行时产物
- `.aa-tool-artifacts/`：工具执行产物
- `logs/`：本地日志输出
- `.DS_Store`：平台无关系统文件

## 当前规则

- 是否提交由 `.gitignore` 与 review/CI 审计共同裁定。
- 删除动作只针对可再生产物，不把工作区中用户正在使用的数据目录当作默认清理对象。
- 文档中不再保留绝对路径和机器特定统计数字。

## 证据入口

- `.gitignore`
- [README.md](./README.md)
- [platforme-full-review-b.md](./platforme-full-review-b.md)
