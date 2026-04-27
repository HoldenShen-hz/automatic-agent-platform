# 医疗健康域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §89 |
| implementation_module | `src/domains/healthcare/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | 执业医师 / 医疗合规负责人 |

## 硬约束

- Agent 只提供医疗信息，不替代医嘱。
- 所有诊疗建议必须经执业医师审核。
- PHI 处理必须遵守最小化、隔离和审计要求。

## 验收入口

- GA 前必须提供医师审核、PHI 隔离、责任边界和患者安全评估证据。
