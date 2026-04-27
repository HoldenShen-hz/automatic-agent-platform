# 人力资源域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §87 |
| implementation_module | `src/domains/human-resources/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | HR 负责人 / 合规负责人 |

## 硬约束

- 招聘、晋升和绩效自动化必须通过偏见审计。
- AIR 必须大于等于 0.8，未达标不得自动决策。
- 候选人和员工数据必须最小化收集并可审计。

## 验收入口

- GA 前必须提供偏见审计、人工复核、数据最小化和申诉流程证据。
