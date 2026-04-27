# IT 运维 SRE/DevOps 域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §93 |
| implementation_module | `src/domains/it-operations/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | SRE 负责人 / 值班负责人 |

## 硬约束

- 自动修复爆炸半径限制为单节点或单服务。
- 跨服务、跨 Region 或生产写操作必须人工审批。
- 诊断、修复、回滚和复盘必须保留证据。

## 验收入口

- GA 前必须提供 blast-radius guard、MTTR 指标、回滚演练和人工审批证据。
