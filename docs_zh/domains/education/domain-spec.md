# 教育培训域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §90 |
| implementation_module | `src/domains/education/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | 教学负责人 / 未成年人数据保护负责人 |

## 硬约束

- 涉未成年人数据必须最小化收集并取得监护人同意。
- 学习建议不得替代教师或机构的最终判断。
- 内容推荐必须经过安全和年龄适配检查。

## 验收入口

- GA 前必须提供监护人同意、数据最小化、内容安全和人工复核证据。
