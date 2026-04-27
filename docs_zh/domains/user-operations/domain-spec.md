# 用户运营域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §77 |
| implementation_module | `src/domains/user-operations/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | 用户运营负责人 |

## 硬约束

- 所有用户触达必须执行频次上限。
- 画像、分群和消息内容必须遵守数据分级策略。
- 高风险触达必须支持暂停、撤回和审计。

## 验收入口

- GA 前必须提供频控、退订、用户分群审计和实验评估证据。
