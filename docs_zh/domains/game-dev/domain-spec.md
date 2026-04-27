# 游戏开发域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §85 |
| implementation_module | `src/domains/game-dev/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | 游戏制作负责人 / IP 法务 |

## 硬约束

- AI 生成美术资产必须经过已知 IP 相似度检测。
- 代码、资源和玩法建议必须保留来源与许可证证据。
- 上线前必须通过安全和版权检查。

## 验收入口

- GA 前必须提供 IP 相似度、资产授权、测试和人工审核证据。
