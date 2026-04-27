# 法务域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §82 |
| implementation_module | `src/domains/legal/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | 执业律师 / 法务负责人 |

## 硬约束

- Agent 只提供法律信息，不提供最终法律意见。
- 所有外发或被采取行动的输出必须经执业律师审核。
- 合同红线、FTO 和争议建议必须保留依据。

## 验收入口

- GA 前必须提供律师审核、输出签核、引用证据和责任边界记录。
