# Phase 2c Skills HR Evolution

## 1. 目标

补齐平台的技能扩展、能力缺口分析与有限进化能力，但保持强治理和可回退。

## 2. 进入条件

- 2b 的稳定性、审计和治理链已经可用
- 角色版本化和 skill 注册边界已有事实源
- 高风险变更有审批和回滚路径
- 进入 2c 前已重新通过 `operations-checklist.md` 的当前阶段签收

## 3. 必做范围

- Skill 系统正式化。
- HR Agent 的能力缺口分析与建议链路。
- 进化引擎 MVP。
- 角色版本化与变更治理。

## 4. 非目标

- 无监管自动扩权。
- 无限自我复制式角色增长。
- 商业生态全面开放。

## 5. 关键 contract / 主文档

- [tool_skill_plugin_contract.md](../../contracts/tool_skill_plugin_contract.md)
- [ecosystem_extension_plane_contract.md](../../contracts/ecosystem_extension_plane_contract.md)
- [adr/007-evolution-engine.md](../../adr/007-evolution-engine.md)
- [agent_contract.md](../../contracts/agent_contract.md)
- [operations-checklist.md](../operations-checklist.md)

## 6. 核心交付物

- Skill registry 与装配文档。
- HR Agent 决策边界。
- 进化提案、审批、应用的最小闭环。
- Phase 2c 安全评审。

## 7. 验收与退出门槛

- 新 skill 与角色变更有审批链。
- 进化提案可回退、可审计。
- HR Agent 不越过治理边界。
- 当前阶段涉及模块已满足 `operations-checklist.md` 中对应的“当前阶段可验收”标准。

## 8. 风险与控制点

- 风险：skill / evolution 变成隐式扩权通道。
- 控制：任何新能力都必须经过注册、审批、版本化和回滚链。
- 风险：HR Agent 从建议者变成自动裁决者。
- 控制：HR Agent 只输出 proposal，不直接改生产配置。

## 9. 向下一阶段交接

- Phase 3 接手的是 PMF、收费和主动模式，不应在 2c 内提前打开生态市场或企业治理全量能力。
