# 在线直播域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §83 |
| implementation_module | `src/domains/live-streaming/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | 直播安全负责人 |

## 硬约束

- 违规内容检测后必须在目标 SLA 内下架或断流。
- 热路径不得依赖通用 LLM/Harness loop。
- 申诉、恢复和误杀处理必须可审计。

## 验收入口

- GA 前必须提供实时检测、5s 处置、申诉流程和误报评估证据。
