# 内容审核与安全域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §92 |
| implementation_module | `src/domains/content-moderation/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | 内容安全负责人 / 法务合规负责人 |

## 硬约束

- CSAM 检测后必须在 1 分钟内上报。
- 违法内容处置、申诉和恢复必须可审计。
- 高风险内容不得由单一模型结论直接放行。

## 验收入口

- GA 前必须提供 CSAM 上报演练、多模态审核、人工复核和申诉流程证据。
