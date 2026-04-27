# 广告推广域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §73 |
| implementation_module | `src/domains/advertising/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | 广告投放负责人 |

## 硬约束

- 每日/每小时预算必须由平台硬上限保护。
- 出价和受众变更必须记录原因、预算影响和回滚策略。
- 低质流量、异常消耗和合规风险必须触发降级或人工审核。

## 验收入口

- GA 前必须提供预算硬上限、ROAS 评估、投放审计和异常消耗告警证据。
