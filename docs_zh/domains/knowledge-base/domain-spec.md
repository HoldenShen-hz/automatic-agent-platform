# 企业知识库域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §80 |
| implementation_module | `src/domains/knowledge-base/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | 知识库 owner / 安全负责人 |

## 硬约束

- 必须镜像源系统文档级权限。
- 查询时必须执行实时访问检查。
- 生成答案必须保留 citation 与 evidence refs。

## 验收入口

- GA 前必须提供权限镜像、跨部门隔离、引用准确率和访问审计证据。
