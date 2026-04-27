# 游戏上架域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §86 |
| implementation_module | `src/domains/game-publishing/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | 发行负责人 / 合规负责人 |

## 硬约束

- 每个目标平台必须独立通过内容、年龄分级、支付和隐私合规检查。
- 禁止跨平台复用审核结果作为最终结论。
- 上架失败、整改和复审必须保留证据。

## 验收入口

- GA 前必须提供平台独立审核、年龄分级、隐私合规和发布记录。
