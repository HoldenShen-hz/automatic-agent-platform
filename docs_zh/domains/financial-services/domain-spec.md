# 金融服务域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §74 |
| implementation_module | `src/domains/financial-services/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | 金融合规负责人 / 信贷负责人 |

## 硬约束

- 不利信贷决策必须可解释且可人工复查。
- AML / SAR / STR 相关判断必须保留审计证据。
- Agent 不得作为最终授信主体。

## 验收入口

- GA 前必须提供公平借贷解释、人工复核、AML 检测和合规报告证据。
