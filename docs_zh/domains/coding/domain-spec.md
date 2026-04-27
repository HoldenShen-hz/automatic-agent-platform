# 代码开发域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §76 |
| implementation_module | `src/domains/coding/index.ts` |
| domain_status | spec_ready |
| risk_level | medium |
| accountable_role | 工程负责人 |

## 硬约束

- 代码修改必须有 diff、测试和回滚证据。
- 执行命令必须受 sandbox、file root 和 approval 策略约束。
- 安全相关改动必须增加 denial-path regression。

## 验收入口

- GA 前必须提供代码审查、测试结果、安全扫描和变更审计证据。
