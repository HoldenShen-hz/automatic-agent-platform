# 客户服务域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §91 |
| implementation_module | `src/domains/customer-service/index.ts` |
| domain_status | spec_ready |
| risk_level | medium |
| accountable_role | 客服运营负责人 |

## 硬约束

- 3 轮未解决必须转接人工坐席。
- Agent 不得做超出授权的赔付、退款或法律承诺。
- 用户承诺和知识来源必须可审计。

## 验收入口

- GA 前必须提供转人工、FCR、AHT、知识引用和承诺审计证据。
