# ADR-015 Skill 与 Plugin 是否收敛为单市场

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：信号采集与统一 DTO
- **Assess**：执行前/后评估与风险判断
- **Plan**：显式规划与 DAG 构建（ADR-060）
- **Execute**：步骤执行与 Dual-Channel 输出
- **Feedback**：信号收集、预处理与 7 类反馈源（ADR-079）
- **Learn**：模式检测与知识提取（ADR-080）
- **Improve**：改进候选评估与 Release 状态机（ADR-075）
- **Release**：六级受控发布与自动回滚

---

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

系统历史材料里曾分别出现 Skill Marketplace、Plugin Marketplace、模板市场等多个扩展入口。如果这些概念长期并存，会导致：

- 安装与权限治理入口分散
- 审核、签名、版本兼容与禁用策略重复建设
- 用户难以理解“到底去哪里找扩展”

当前阶段并不会真正实现 marketplace，但需要先冻结方向，避免后面文档继续沿不同市场模型发散。

## 决策

Phase 1a / 1b 不实现 marketplace。

长期方向上，Skill、Plugin、模板等扩展能力收敛为统一治理入口，而不是维护多个市场模型。

这意味着：

- 当前只保留扩展对象模型和治理 contract
- 真正进入 Phase 4 时，优先建设统一 extension marketplace

## 备选方案

### 方案 A：长期维持多个市场

优点：

- 每类扩展看起来更“贴合自身语义”。

代价：

- 用户心智负担重。
- 审核、权限、签名、兼容、下架、计费能力高度重复。
- 平台治理复杂度明显上升。

### 方案 B：当前就实现统一市场

优点：

- 路径最直接。

代价：

- 明显超阶段。
- 当前连内部扩展治理都尚未进入实现，提前做市场只会把平台拉重。

### 方案 C：当前决策方案

- 当前不实现 marketplace
- 长期方向收敛为统一入口
- 先在 contract 层统一 extension object、permission 和 lifecycle

## 选择这个方案的原因

- 当前阶段最重要的是内部扩展边界，不是市场产品形态。
- 统一治理入口更符合权限、审批、签名、兼容性和计费的长期需要。
- 先冻结方向，可以阻止文档继续出现多个并列市场概念。

## 关键不变量

- Skill、Plugin、模板未来都应经过统一治理链。
- 安装单元不得绕过 ToolRegistry、Policy Engine 和权限审查。
- 即使前端展示分栏，也不代表后端要维护多个市场内核。

## 采用触发条件

在正式进入以下主题前，应继续遵守该方向：

- ecosystem extension plane
- monetization metering plane
- enterprise operations plane

## 退出条件

若未来证明：

- Skill 与 Plugin 的生命周期、风险模型、商业模式完全不同
- 统一治理带来的复杂度反而更高

则可重新开 ADR 讨论拆分，但不能在没有新决策的情况下回到“多个市场并行演化”。

## 实施影响

当前文档与后续实现要求：

- contract 和文档中尽量使用统一的 extension / installable / capability registry 语言
- Phase 1a / 1b 只做 registry、权限、安装边界，不做市场 UI 或商业化分发
- Phase 4 若开始做 marketplace，应直接从统一治理入口设计，而不是先做多套市场再合并

## 结果

优点：

- 长期治理更一致。
- 用户心智更简单。
- 权限、签名、版本兼容和计费更容易统一。

代价：

- 需要在未来真正实现时，把不同扩展类型抽象到同一治理模型中。
- 某些类型特有能力可能需要额外的 subtype 规则，而不是完全平铺处理。

## 交叉引用

- [ADR-014 组织模型是否直接映射到代码对象](./014-org-model-code-boundary.md)
- [ADR-005 安全模型](./005-security-model.md)
- [ADR-010 商业模式](./010-commercial-model.md)

## 来源章节

- `tool_skill_plugin_contract.md`
- `ecosystem_extension_plane_contract.md`
