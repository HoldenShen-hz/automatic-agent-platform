# 财务域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §81 |
| implementation_module | `src/domains/finance-accounting/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | 财务负责人 / 内控负责人 |

## 硬约束

- 必须执行职责分离：创建人不得等于审批人。
- 会计分录、报表和付款动作必须可审计。
- Agent 不得绕过 SOX 内控和人工审批。

## 验收入口

- GA 前必须提供 SoD、审计抽样、付款审批和财报一致性证据。
