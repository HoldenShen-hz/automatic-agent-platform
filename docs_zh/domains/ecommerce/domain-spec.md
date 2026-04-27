# 电商域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §72 |
| implementation_module | `src/domains/ecommerce/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | 电商运营负责人 |

## 硬约束

- 价格变动超过阈值必须人工审批。
- 促销、库存和订单动作必须保留可审计证据。
- Agent 不得绕过平台预算、审批和 SideEffect 对账。

## 验收入口

- GA 前必须提供价格 guardrail、订单副作用对账、库存一致性和客服转人工证据。
