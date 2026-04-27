# 量化交易域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §71 |
| implementation_module | `src/domains/quant-trading/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | 持牌交易负责人 / 风控负责人 |

## 硬约束

- 所有订单候选必须经过盘前风控检查。
- 仓位、损失限额和交易热路径不得由 Agent 覆写。
- 超低延迟下单路径不得依赖通用 LLM/Harness loop。

## 验收入口

- DomainDescriptor、DomainRiskProfile、DomainEvalFramework 必须先通过 §38 四阶段门禁。
- GA 前必须提供交易风控、回测、人工批准、审计和 kill-switch 证据。
